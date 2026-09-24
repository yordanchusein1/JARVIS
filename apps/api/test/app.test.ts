import { createApiKey, connectDatabase, runMigrations } from '@jarvis/core';
import { createJarvisClient } from '@jarvis/sdk';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must point to a disposable test database');

await runMigrations(url);
const { db, close } = connectDatabase(url);
const queued: string[] = [];
const { app } = createApp({ db, auditQueue: { enqueue: async (ids) => void queued.push(...ids) } });

// The SDK talks to the app in-process, so these tests also cover the generated client.
function client(apiKey: string) {
  return createJarvisClient({
    baseUrl: 'http://jarvis.test',
    apiKey,
    fetch: (input) => Promise.resolve(app.fetch(input as Request)),
  });
}

let jarvis = client('');

beforeEach(async () => {
  await db.execute(sql`TRUNCATE api_keys, businesses CASCADE`);
  jarvis = client((await createApiKey(db, 'test')).key);
});
afterAll(() => close());

describe('public endpoints', () => {
  it('serves health and the OpenAPI document without a key', async () => {
    const health = await client('').GET('/health');
    expect(health.data).toEqual({ status: 'ok' });

    const doc = (await (await app.request('/v1/openapi.json')).json()) as { paths: object };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/businesses',
        '/businesses/{id}',
        '/businesses/{id}/audits',
      ]),
    );
  });
});

describe('authentication', () => {
  it.each([undefined, 'Bearer jrv_wrong', 'Basic abc'])('rejects %s', async (header) => {
    const res = await app.request('/v1/businesses', {
      headers: header ? { authorization: header } : {},
    });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid key through the SDK', async () => {
    const { error, response } = await client('jrv_wrong').GET('/businesses');
    expect(response.status).toBe(401);
    expect(error?.error.code).toBe('unauthorized');
  });
});

describe('businesses', () => {
  it('tracks websites, queues audits, lists them and fetches one', async () => {
    const { data: tracked } = await jarvis.POST('/businesses', {
      body: { websites: ['klinik.co.id', 'www.klinik.co.id', 'localhost'] },
    });
    expect(tracked?.created).toBe(1);
    expect(tracked?.skipped).toHaveLength(1);
    const business = tracked?.data[0];
    expect(business).toMatchObject({
      websiteUrl: 'https://klinik.co.id/',
      source: 'url',
      status: 'new',
      priority: null,
      latestAudit: { status: 'queued', needScore: null, notes: [] },
    });
    expect(queued).toContain(business?.latestAudit?.id);

    // Tracking the same website again neither duplicates it nor queues another audit.
    const again = await jarvis.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    expect(again.data?.created).toBe(0);
    expect(again.data?.data[0]?.id).toBe(business?.id);

    const { data: list } = await jarvis.GET('/businesses');
    expect(list?.data).toHaveLength(1);

    const { data: one } = await jarvis.GET('/businesses/{id}', {
      params: { path: { id: business!.id } },
    });
    expect(one).toMatchObject({ id: business!.id, signals: [], contacts: [] });
  });

  it('queues a new audit on request', async () => {
    const { data: tracked } = await jarvis.POST('/businesses', {
      body: { websites: ['klinik.co.id'] },
    });
    const id = tracked!.data[0]!.id;

    const { data: audit, response } = await jarvis.POST('/businesses/{id}/audits', {
      params: { path: { id } },
    });
    expect(response.status).toBe(202);
    expect(audit?.status).toBe('queued');
    expect(queued).toContain(audit?.id);

    const missing = await jarvis.POST('/businesses/{id}/audits', {
      params: { path: { id: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(missing.response.status).toBe(404);
  });

  it('validates input', async () => {
    const empty = await jarvis.POST('/businesses', { body: { websites: [] } });
    expect(empty.response.status).toBe(400);

    const badId = await jarvis.GET('/businesses/{id}', { params: { path: { id: 'not-a-uuid' } } });
    expect(badId.response.status).toBe(400);
  });

  it('returns 404 for an unknown business', async () => {
    const { error, response } = await jarvis.GET('/businesses/{id}', {
      params: { path: { id: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(response.status).toBe(404);
    expect(error?.error.code).toBe('not_found');
  });
});
