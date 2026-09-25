import { describe, expect, it } from 'vitest';
import { createArclightHandler } from '../src/server.ts';

function setup(authorized = true) {
  const calls: { url: string; init: RequestInit }[] = [];
  const handler = createArclightHandler({
    apiUrl: 'http://arclight.internal:8787/',
    apiKey: 'arc_secret',
    authorize: () => authorized,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init! });
      return Response.json({ data: [] }, { headers: { 'set-cookie': 'upstream=1' } });
    },
  });
  return { handler, calls };
}

const request = (path: string, init: RequestInit = {}) =>
  new Request(`https://admin.example.com${path}`, init);

describe('createArclightHandler', () => {
  it('forwards API calls with the key, which never reaches the browser', async () => {
    const { handler, calls } = setup();
    const response = await handler(request('/api/arclight/v1/businesses?limit=5'));
    expect(response.status).toBe(200);
    expect(calls[0]!.url).toBe('http://arclight.internal:8787/v1/businesses?limit=5');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer arc_secret');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.text()).not.toContain('arc_secret');
  });

  it('refuses people who are not authorized', async () => {
    const { handler, calls } = setup(false);
    const response = await handler(request('/api/arclight/v1/businesses'));
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('only reaches the versioned API', async () => {
    const { handler, calls } = setup();
    for (const path of ['/api/arclight/health', '/api/arclight', '/api/other/v1/businesses']) {
      expect((await handler(request(path))).status).toBe(404);
    }
    expect(calls).toHaveLength(0);
  });

  it('forwards changes from the same site and refuses cross-site ones', async () => {
    const { handler, calls } = setup();
    const change = (origin?: string) =>
      handler(
        request('/api/arclight/v1/businesses/1', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
          body: JSON.stringify({ status: 'contacted' }),
        }),
      );
    expect((await change('https://evil.example')).status).toBe(403);
    expect((await change()).status).toBe(403);
    expect((await change('https://admin.example.com')).status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe('PATCH');
    expect(new TextDecoder().decode(calls[0]!.init.body as ArrayBuffer)).toBe(
      '{"status":"contacted"}',
    );
  });

  it('can be created before its settings exist, and says when they are missing', async () => {
    const handler = createArclightHandler({
      apiUrl: undefined,
      apiKey: undefined,
      authorize: () => true,
    });
    expect((await handler(request('/api/arclight/v1/briefing'))).status).toBe(503);
  });

  it('reports an unreachable API', async () => {
    const handler = createArclightHandler({
      apiUrl: 'http://arclight.internal:8787',
      apiKey: 'arc_secret',
      authorize: () => true,
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect((await handler(request('/api/arclight/v1/briefing'))).status).toBe(502);
  });
});
