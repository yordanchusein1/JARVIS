/**
 * Google Gemini as an alternative to Claude for drafting and chat, through the Gemini API's REST
 * endpoints. The chat model translates to and from the message shapes the chat loop uses.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ChatModel } from './chat.ts';
import { DRAFT_SYSTEM_PROMPT, renderDraftRequest, type DraftWriter } from './drafting.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
  error?: { message?: string };
}

interface GeminiOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class GeminiError extends Error {
  override name = 'GeminiError';
}

const BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

async function call(
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 120_000,
  }: GeminiOptions,
  method: 'generateContent' | 'streamGenerateContent',
  body: unknown,
): Promise<Response> {
  const url = `${API}/${encodeURIComponent(model)}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as GeminiResponse | null;
    throw new GeminiError(
      `Gemini returned HTTP ${response.status}: ${failure?.error?.message ?? 'unknown error'}`,
    );
  }
  return response;
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    whatsapp: { type: 'string', description: 'The WhatsApp message' },
    emailSubject: { type: 'string', description: 'The email subject line' },
    emailBody: { type: 'string', description: 'The email body, plain text' },
  },
  required: ['whatsapp', 'emailSubject', 'emailBody'],
};

export function createGeminiDraftWriter(options: GeminiOptions): DraftWriter {
  return async (request) => {
    const response = await call(options, 'generateContent', {
      systemInstruction: { parts: [{ text: DRAFT_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: renderDraftRequest(request) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: DRAFT_SCHEMA,
      },
    });
    const body = (await response.json()) as GeminiResponse;
    const candidate = body.candidates?.[0];
    if (body.promptFeedback?.blockReason || BLOCKED.has(candidate?.finishReason ?? '')) {
      throw new Error('The model declined to write this message.');
    }
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');
    let parsed: { whatsapp?: unknown; emailSubject?: unknown; emailBody?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `The model returned no usable draft (finish reason: ${candidate?.finishReason}).`,
      );
    }
    const { whatsapp, emailSubject, emailBody } = parsed;
    if (
      typeof whatsapp !== 'string' ||
      typeof emailSubject !== 'string' ||
      typeof emailBody !== 'string'
    ) {
      throw new Error('The model returned an incomplete draft.');
    }
    return {
      whatsapp,
      emailSubject,
      emailBody,
      model: body.modelVersion ?? options.model ?? DEFAULT_GEMINI_MODEL,
    };
  };
}

/** A tool call as the chat loop sees it, plus Gemini's signature, which must be sent back. */
type ToolUse = Anthropic.Beta.BetaToolUseBlock & { geminiSignature?: string };

function toGeminiContents(messages: Anthropic.Beta.BetaMessageParam[]): GeminiContent[] {
  const toolNames = new Map<string, string>();
  return messages.map((message) => {
    if (typeof message.content === 'string') {
      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      };
    }
    const parts: GeminiPart[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_use') {
        const use = block as ToolUse;
        toolNames.set(use.id, use.name);
        parts.push({
          functionCall: { name: use.name, args: (use.input ?? {}) as Record<string, unknown> },
          ...(use.geminiSignature ? { thoughtSignature: use.geminiSignature } : {}),
        });
      } else if (block.type === 'tool_result') {
        const content =
          typeof block.content === 'string'
            ? block.content
            : (block.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join('');
        parts.push({
          functionResponse: {
            name: toolNames.get(block.tool_use_id) ?? 'unknown',
            response: block.is_error ? { error: content } : { result: content },
          },
        });
      }
    }
    return { role: message.role === 'assistant' ? 'model' : 'user', parts };
  });
}

async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<GeminiResponse> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '');
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) yield JSON.parse(data) as GeminiResponse;
    }
  }
}

export function createGeminiChatModel(options: GeminiOptions): ChatModel {
  return async ({ system, messages, tools }, onText) => {
    const response = await call(options, 'streamGenerateContent', {
      systemInstruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.input_schema,
          })),
        },
      ],
    });
    if (!response.body) throw new GeminiError('Gemini returned an empty response.');

    const content: (Anthropic.Beta.BetaTextBlock | ToolUse)[] = [];
    let text = '';
    let finishReason = '';
    let blocked = false;
    let modelVersion = options.model ?? DEFAULT_GEMINI_MODEL;
    for await (const event of sseEvents(response.body)) {
      if (event.error) throw new GeminiError(event.error.message ?? 'Gemini failed.');
      if (event.promptFeedback?.blockReason) blocked = true;
      if (event.modelVersion) modelVersion = event.modelVersion;
      const candidate = event.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      for (const part of candidate?.content?.parts ?? []) {
        if (part.functionCall) {
          content.push({
            type: 'tool_use',
            id: `gemini_${content.length}_${Date.now().toString(36)}`,
            name: part.functionCall.name,
            input: part.functionCall.args ?? {},
            geminiSignature: part.thoughtSignature,
          } as ToolUse);
        } else if (part.text && !part.thought) {
          text += part.text;
          onText(part.text);
        }
      }
    }
    if (text)
      content.unshift({ type: 'text', text, citations: null } as Anthropic.Beta.BetaTextBlock);

    const stopReason =
      blocked || BLOCKED.has(finishReason)
        ? 'refusal'
        : content.some((b) => b.type === 'tool_use')
          ? 'tool_use'
          : finishReason === 'MAX_TOKENS'
            ? 'max_tokens'
            : 'end_turn';
    return {
      id: `gemini_${Date.now().toString(36)}`,
      type: 'message',
      role: 'assistant',
      model: modelVersion,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
    } as unknown as Anthropic.Beta.BetaMessage;
  };
}
