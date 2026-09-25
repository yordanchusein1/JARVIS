import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createArclightClient } from '@arclight/sdk';
import { describe, expect, it } from 'vitest';
import { createMcpServer } from '../src/server.ts';

const LEAD_ID = '11111111-1111-4111-8111-111111111111';

const lead = {
  id: LEAD_ID,
  source: 'places',
  placeId: 'ChIJ1',
  huntId: null,
  websiteUrl: 'https://klinik.co.id/',
  displayName: 'Klinik Gigi Senyum',
  status: 'new',
  feedback: null,
  priority: 87,
  latestAudit: {
    id: '22222222-2222-4222-8222-222222222222',
    status: 'succeeded',
    needScore: 100,
    capacityScore: 75,
    error: null,
    notes: [],
    createdAt: '2026-09-25T00:00:00.000Z',
    finishedAt: '2026-09-25T00:01:00.000Z',
  },
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

/** A stand-in for the Arclight API that records the requests it gets. */
function fakeApi() {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const fetch = async (input: Request) => {
    const url = new URL(input.url);
    const body = input.method === 'GET' ? undefined : await input.json().catch(() => undefined);
    requests.push({ method: input.method, path: url.pathname + url.search, body });
    const path = url.pathname.replace(/^\/v1/, '');
    if (path === '/businesses' && input.method === 'GET') return Response.json({ data: [lead] });
    if (path === `/businesses/${LEAD_ID}`) {
      if (input.method === 'PATCH') return Response.json({ ...lead, ...(body as object) });
      return Response.json({
        ...lead,
        signals: [],
        contacts: [{ kind: 'email', value: 'info@klinik.co.id', sourceUrl: null }],
        drafts: [
          {
            id: 'd1',
            channel: 'whatsapp',
            subject: null,
            body: 'Halo & salam',
            warnings: [],
            model: 'm',
            createdAt: '',
          },
          {
            id: 'd2',
            channel: 'email',
            subject: 'Website',
            body: 'Isi',
            warnings: [],
            model: 'm',
            createdAt: '',
          },
        ],
        doNotContact: false,
      });
    }
    if (path === `/businesses/${LEAD_ID}/place`) {
      return Response.json({
        placeId: 'ChIJ1',
        name: 'Klinik',
        address: null,
        websiteUrl: null,
        phone: '+62311234567',
        rating: 4.8,
        ratingCount: 812,
        mapsUrl: null,
      });
    }
    if (path === `/businesses/${LEAD_ID}/drafts`) {
      return Response.json(
        { error: { code: 'not_ready', message: 'Complete the agency profile first.' } },
        { status: 409 },
      );
    }
    return Response.json(
      { error: { code: 'not_found', message: 'Route not found' } },
      { status: 404 },
    );
  };
  return { requests, fetch };
}

function setup() {
  const api = fakeApi();
  const arclight = createArclightClient({
    baseUrl: 'http://arclight.test',
    apiKey: 'arc_test',
    fetch: (input) => api.fetch(input as Request),
  });
  const server = createMcpServer({ arclight });
  let id = 0;
  const call = (method: string, params?: object) =>
    server.handle({ jsonrpc: '2.0', id: ++id, method, params });
  return { api, server, call };
}

describe('MCP server', () => {
  it('initializes with a supported protocol version and instructions', async () => {
    const { call } = setup();
    const response = (await call('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })) as { result: { protocolVersion: string; capabilities: object; instructions: string } };
    expect(response.result.protocolVersion).toBe('2025-06-18');
    expect(response.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(response.result.instructions).toMatch(/never sends messages/);

    const future = (await call('initialize', { protocolVersion: '2099-01-01' })) as {
      result: { protocolVersion: string };
    };
    expect(future.result.protocolVersion).toBe('2025-11-25');
  });

  it('lists tools, and none of them sends messages', async () => {
    const { call } = setup();
    const { result } = (await call('tools/list')) as {
      result: { tools: { name: string; inputSchema: { type: string } }[] };
    };
    const names = result.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_briefing',
        'get_lead',
        'search_places',
        'write_drafts',
        'create_hunt',
      ]),
    );
    expect(names.some((n) => /send/.test(n))).toBe(false);
    expect(result.tools.every((t) => t.inputSchema.type === 'object')).toBe(true);
  });

  it('calls the API and returns text plus structured content', async () => {
    const { call, api } = setup();
    const { result } = (await call('tools/call', {
      name: 'list_leads',
      arguments: { limit: 5 },
    })) as { result: { content: { text: string }[]; structuredContent: { leads: object[] } } };
    expect(api.requests[0]).toMatchObject({
      method: 'GET',
      path: '/v1/businesses?limit=5&offset=0',
    });
    expect(result.structuredContent.leads[0]).toEqual({
      id: LEAD_ID,
      name: 'Klinik Gigi Senyum',
      website: 'https://klinik.co.id/',
      fromGoogleMaps: true,
      status: 'new',
      priority: 87,
      need: 100,
      capacity: 75,
      audit: 'succeeded',
    });
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
  });

  it('gives send links for the person, using the Google phone when needed', async () => {
    const { call } = setup();
    const { result } = (await call('tools/call', {
      name: 'get_lead',
      arguments: { id: LEAD_ID },
    })) as { result: { structuredContent: { sendLinks: { channel: string; url: string }[] } } };
    expect(result.structuredContent.sendLinks).toEqual([
      {
        channel: 'whatsapp',
        to: '+62311234567',
        url: 'https://wa.me/62311234567?text=Halo%20%26%20salam',
      },
      {
        channel: 'email',
        to: 'info@klinik.co.id',
        url: 'mailto:info@klinik.co.id?subject=Website&body=Isi',
      },
    ]);
  });

  it('reports API and argument errors as tool errors', async () => {
    const { call } = setup();
    const notReady = (await call('tools/call', {
      name: 'write_drafts',
      arguments: { id: LEAD_ID },
    })) as { result: { isError: boolean; content: { text: string }[] } };
    expect(notReady.result.isError).toBe(true);
    expect(notReady.result.content[0]!.text).toBe(
      'Complete the agency profile first. (not_ready).',
    );

    const missing = (await call('tools/call', { name: 'get_lead', arguments: {} })) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(missing.result).toMatchObject({ isError: true });
    expect(missing.result.content[0]!.text).toMatch(/"id"/);

    const wrongType = (await call('tools/call', {
      name: 'list_leads',
      arguments: { limit: 'ten' },
    })) as { result: { isError: boolean } };
    expect(wrongType.result.isError).toBe(true);

    const noStatus = (await call('tools/call', {
      name: 'update_lead',
      arguments: { id: LEAD_ID },
    })) as { result: { isError: boolean } };
    expect(noStatus.result.isError).toBe(true);
  });

  it('follows JSON-RPC for unknown tools, unknown methods, notifications and bad input', async () => {
    const { call, server } = setup();
    expect(await call('tools/call', { name: 'send_whatsapp', arguments: {} })).toMatchObject({
      error: { code: -32602 },
    });
    expect(await call('resources/list')).toMatchObject({ error: { code: -32601 } });
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(JSON.parse((await server.handleLine('{oops'))!)).toMatchObject({
      error: { code: -32700 },
    });
    expect(await call('ping')).toMatchObject({ result: {} });
  });
});

describe('stdio transport', () => {
  it('answers requests line by line against a real HTTP API', async () => {
    const http = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify(
          req.headers.authorization === 'Bearer arc_test' ? { data: [lead] } : { error: {} },
        ),
      );
    });
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const { port } = http.address() as AddressInfo;

    const child = spawn('npx', ['tsx', 'src/stdio.ts'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        ARCLIGHT_API_URL: `http://127.0.0.1:${port}`,
        ARCLIGHT_API_KEY: 'arc_test',
      },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stdin.write(
      [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'list_leads', arguments: {} },
        },
      ]
        .map((m) => JSON.stringify(m))
        .join('\n') + '\n',
    );
    child.stdin.end();
    await new Promise((resolve) => child.on('exit', resolve));
    http.close();

    const responses = output
      .trim()
      .split('\n')
      .map(
        (l) =>
          JSON.parse(l) as {
            id: number;
            result: { structuredContent?: { leads: { id: string }[] } };
          },
      );
    expect(responses.map((r) => r.id).sort()).toEqual([1, 2]);
    expect(responses.find((r) => r.id === 2)?.result.structuredContent?.leads[0]?.id).toBe(LEAD_ID);
  }, 30_000);
});
