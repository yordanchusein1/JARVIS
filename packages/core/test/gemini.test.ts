import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createGeminiChatModel, createGeminiDraftWriter } from '../src/gemini.ts';

const request = {
  agency: {
    agencyName: 'Vera & Co',
    senderName: 'Yordan',
    services: 'Websites',
    tone: 'friendly',
    language: 'Indonesian',
  },
  business: { name: 'Klinik Senyum', websiteUrl: 'https://example.com' },
  evidence: [{ axis: 'need' as const, text: 'Loads in 9 seconds on phones.' }],
};

function fakeFetch(respond: (body: Record<string, unknown>, url: string) => Response) {
  const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body, headers: new Headers(init?.headers) });
    return respond(body, String(url));
  }) as typeof globalThis.fetch;
  return { calls, fetchImpl };
}

const sse = (...events: unknown[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });

describe('createGeminiDraftWriter', () => {
  it('asks for JSON and returns the draft', async () => {
    const draft = { whatsapp: 'Halo', emailSubject: 'Situs Anda', emailBody: 'Isi' };
    const { calls, fetchImpl } = fakeFetch(() =>
      Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason: 'STOP' },
        ],
        modelVersion: 'gemini-test',
      }),
    );
    const write = createGeminiDraftWriter({ apiKey: 'k', model: 'gemini-test', fetchImpl });
    expect(await write(request)).toEqual({ ...draft, model: 'gemini-test' });
    expect(calls[0]!.url).toContain('/models/gemini-test:generateContent');
    expect(calls[0]!.headers.get('x-goog-api-key')).toBe('k');
    expect(JSON.stringify(calls[0]!.body)).toContain('Loads in 9 seconds on phones.');
  });

  it('reports a refusal and API errors', async () => {
    const blocked = fakeFetch(() => Response.json({ candidates: [{ finishReason: 'SAFETY' }] }));
    await expect(
      createGeminiDraftWriter({ apiKey: 'k', fetchImpl: blocked.fetchImpl })(request),
    ).rejects.toThrow('declined');
    const failing = fakeFetch(() =>
      Response.json({ error: { message: 'API key not valid' } }, { status: 400 }),
    );
    await expect(
      createGeminiDraftWriter({ apiKey: 'k', fetchImpl: failing.fetchImpl })(request),
    ).rejects.toThrow('API key not valid');
  });
});

describe('createGeminiChatModel', () => {
  const tools = [
    {
      name: 'list_leads',
      description: 'List leads',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
  ];

  it('streams text and turns function calls into tool calls, then sends results back', async () => {
    let turn = 0;
    const { calls, fetchImpl } = fakeFetch(() =>
      turn++ === 0
        ? sse(
            { candidates: [{ content: { parts: [{ text: 'Sebentar, ' }] } }] },
            {
              candidates: [
                {
                  content: {
                    parts: [
                      { functionCall: { name: 'list_leads', args: {} }, thoughtSignature: 'sig' },
                    ],
                  },
                  finishReason: 'STOP',
                },
              ],
            },
          )
        : sse({
            candidates: [{ content: { parts: [{ text: 'Ada 2 lead.' }] }, finishReason: 'STOP' }],
          }),
    );
    const model = createGeminiChatModel({ apiKey: 'k', fetchImpl });
    const deltas: string[] = [];
    const first = await model(
      { system: 'sys', messages: [{ role: 'user', content: 'Lead terbaik?' }], tools },
      (d) => deltas.push(d),
    );
    expect(first.stop_reason).toBe('tool_use');
    expect(deltas).toEqual(['Sebentar, ']);
    const use = first.content.find((b) => b.type === 'tool_use') as Anthropic.Beta.BetaToolUseBlock;
    expect(use.name).toBe('list_leads');

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: 'user', content: 'Lead terbaik?' },
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: use.id, content: '[]' }] },
    ];
    const second = await model({ system: 'sys', messages, tools }, () => {});
    expect(second.stop_reason).toBe('end_turn');

    const sent = calls[1]!.body as {
      contents: { role: string; parts: Record<string, unknown>[] }[];
    };
    expect(calls[1]!.url).toContain(':streamGenerateContent?alt=sse');
    expect(sent.contents[1]).toEqual({
      role: 'model',
      parts: [
        { text: 'Sebentar, ' },
        { functionCall: { name: 'list_leads', args: {} }, thoughtSignature: 'sig' },
      ],
    });
    expect(sent.contents[2]).toEqual({
      role: 'user',
      parts: [{ functionResponse: { name: 'list_leads', response: { result: '[]' } } }],
    });
  });
});
