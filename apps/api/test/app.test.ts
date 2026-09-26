import {
  createApiKey,
  connectDatabase,
  runMigrations,
  schema,
  type ChatModel,
  type DraftWriter,
  type PlacesClient,
} from '@arclight/core';
import type Anthropic from '@anthropic-ai/sdk';
import { createArclightClient } from '@arclighthq/sdk';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must point to a disposable test database');

await runMigrations(url);
const { db, close } = connectDatabase(url);
const queued: string[] = [];
const auditQueue = { enqueue: async (ids: string[]) => void queued.push(...ids) };
const draftWriter: DraftWriter = async () => ({
  whatsapp: 'Halo dari Vera & Co',
  emailSubject: 'Website Anda',
  emailBody: 'Isi email',
  model: 'test-model',
});
const places: PlacesClient = {
  searchText: async () => [
    {
      placeId: 'ChIJ1',
      name: 'Klinik A',
      address: 'Surabaya',
      websiteUrl: 'https://a.co.id/',
      phone: null,
      rating: 4.8,
      ratingCount: 812,
      mapsUrl: null,
    },
  ],
  getPlace: async (id) =>
    id === 'ChIJ1'
      ? {
          placeId: 'ChIJ1',
          name: 'Klinik A',
          address: 'Surabaya',
          websiteUrl: 'https://a.co.id/',
          phone: '+62311',
          rating: 4.8,
          ratingCount: 812,
          mapsUrl: null,
        }
      : null,
};
const chatModel: ChatModel = async ({ messages }, onText) => {
  const last = messages.at(-1)!;
  if (last.role === 'user' && typeof last.content === 'string') {
    return {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't1', name: 'list_leads', input: {} }],
    } as Anthropic.Beta.BetaMessage;
  }
  onText('Belum ada lead.');
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Belum ada lead.', citations: null }],
  } as Anthropic.Beta.BetaMessage;
};
const { app } = createApp({ db, auditQueue, draftWriter, places, chatModel });

// The SDK talks to the app in-process, so these tests also cover the generated client.
function client(apiKey: string) {
  return createArclightClient({
    baseUrl: 'http://arclight.test',
    apiKey,
    fetch: (input) => Promise.resolve(app.fetch(input as Request)),
  });
}

let arclight = client('');
let arclightKey = '';

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE api_keys, hunts, businesses, agency_profile, do_not_contact CASCADE`,
  );
  const key = (await createApiKey(db, 'test')).key;
  arclight = client(key);
  arclightKey = `Bearer ${key}`;
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
  it.each([undefined, 'Bearer arc_wrong', 'Basic abc'])('rejects %s', async (header) => {
    const res = await app.request('/v1/businesses', {
      headers: header ? { authorization: header } : {},
    });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid key through the SDK', async () => {
    const { error, response } = await client('arc_wrong').GET('/businesses');
    expect(response.status).toBe(401);
    expect(error?.error.code).toBe('unauthorized');
  });
});

describe('businesses', () => {
  it('tracks websites, queues audits, lists them and fetches one', async () => {
    const { data: tracked } = await arclight.POST('/businesses', {
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
    const again = await arclight.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    expect(again.data?.created).toBe(0);
    expect(again.data?.data[0]?.id).toBe(business?.id);

    const { data: list } = await arclight.GET('/businesses');
    expect(list?.data).toHaveLength(1);

    const { data: one } = await arclight.GET('/businesses/{id}', {
      params: { path: { id: business!.id } },
    });
    expect(one).toMatchObject({ id: business!.id, signals: [], contacts: [] });
  });

  it('queues a new audit on request', async () => {
    const { data: tracked } = await arclight.POST('/businesses', {
      body: { websites: ['klinik.co.id'] },
    });
    const id = tracked!.data[0]!.id;

    const { data: audit, response } = await arclight.POST('/businesses/{id}/audits', {
      params: { path: { id } },
    });
    expect(response.status).toBe(202);
    expect(audit?.status).toBe('queued');
    expect(queued).toContain(audit?.id);

    const missing = await arclight.POST('/businesses/{id}/audits', {
      params: { path: { id: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(missing.response.status).toBe(404);
  });

  it('validates input', async () => {
    const empty = await arclight.POST('/businesses', { body: { websites: [] } });
    expect(empty.response.status).toBe(400);

    const badId = await arclight.GET('/businesses/{id}', {
      params: { path: { id: 'not-a-uuid' } },
    });
    expect(badId.response.status).toBe(400);
  });

  it('returns 404 for an unknown business', async () => {
    const { error, response } = await arclight.GET('/businesses/{id}', {
      params: { path: { id: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(response.status).toBe(404);
    expect(error?.error.code).toBe('not_found');
  });
});

describe('pipeline and drafts', () => {
  async function trackedId() {
    const { data } = await arclight.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    return data!.data[0]!.id;
  }

  it('moves a lead through the pipeline', async () => {
    const id = await trackedId();
    const { data } = await arclight.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { status: 'contacted' },
    });
    expect(data?.status).toBe('contacted');

    const bad = await arclight.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { status: 'invented' as 'won' },
    });
    expect(bad.response.status).toBe(400);
  });

  it('stores the agency profile', async () => {
    const { data } = await arclight.PATCH('/agency-profile', {
      body: { agencyName: 'Vera & Co', senderName: 'Yordan', services: 'Website' },
    });
    expect(data).toMatchObject({
      agencyName: 'Vera & Co',
      language: 'id',
      timezone: 'Asia/Jakarta',
      followUpDays: 3,
    });
    expect((await arclight.GET('/agency-profile')).data?.senderName).toBe('Yordan');

    const invalid = await arclight.PATCH('/agency-profile', { body: { timezone: 'Mars/Base' } });
    expect(invalid.response.status).toBe(400);
    const updated = await arclight.PATCH('/agency-profile', {
      body: { timezone: 'Asia/Makassar', followUpDays: 5 },
    });
    expect(updated.data).toMatchObject({ timezone: 'Asia/Makassar', followUpDays: 5 });
    expect(updated.data?.automationPaused).toBe(false);

    const paused = await arclight.PATCH('/agency-profile', { body: { automationPaused: true } });
    expect(paused.data).toMatchObject({ automationPaused: true, followUpDays: 5 });
  });

  it('writes drafts only when the lead is ready', async () => {
    const id = await trackedId();
    const notReady = await arclight.POST('/businesses/{id}/drafts', { params: { path: { id } } });
    expect(notReady.response.status).toBe(409);
    expect(notReady.error?.error.message).toContain('agency profile');

    await arclight.PATCH('/agency-profile', {
      body: { agencyName: 'Vera & Co', senderName: 'Yordan', services: 'Website' },
    });
    await db.update(schema.audits).set({ status: 'succeeded', needScore: 50, capacityScore: 50 });

    const { data, response } = await arclight.POST('/businesses/{id}/drafts', {
      params: { path: { id } },
    });
    expect(response.status).toBe(201);
    expect(data?.data.map((d) => d.channel)).toEqual(['whatsapp', 'email']);

    const { data: lead } = await arclight.GET('/businesses/{id}', { params: { path: { id } } });
    expect(lead?.drafts.map((d) => d.body)).toEqual(['Halo dari Vera & Co', 'Isi email']);
  });

  it('reports when no language model is configured', async () => {
    const { app: bare } = createApp({ db, auditQueue });
    const id = await trackedId();
    const res = await bare.request(`/v1/businesses/${id}/drafts`, {
      method: 'POST',
      headers: { authorization: arclightKey },
    });
    expect(res.status).toBe(503);
  });
});

describe('week 3', () => {
  it('searches Google Places live and tracks picked places by ID', async () => {
    const search = await arclight.GET('/places/search', {
      params: { query: { q: 'klinik gigi' } },
    });
    expect(search.data?.data[0]).toMatchObject({
      placeId: 'ChIJ1',
      businessId: null,
      ratingCount: 812,
    });

    const { data } = await arclight.POST('/businesses/places', { body: { placeIds: ['ChIJ1'] } });
    expect(data?.created).toBe(1);
    const business = data!.data[0]!;
    expect(business).toMatchObject({ source: 'places', placeId: 'ChIJ1', websiteUrl: null });

    const again = await arclight.GET('/places/search', { params: { query: { q: 'klinik gigi' } } });
    expect(again.data?.data[0]?.businessId).toBe(business.id);

    const live = await arclight.GET('/businesses/{id}/place', {
      params: { path: { id: business.id } },
    });
    expect(live.data).toMatchObject({ name: 'Klinik A', phone: '+62311' });
  });

  it('imports websites from CSV', async () => {
    const { data } = await arclight.POST('/businesses/import', {
      body: { csv: 'Nama,Website\nKlinik A,klinik-a.co.id\nKlinik B,klinik-b.co.id\n' },
    });
    expect(data?.created).toBe(2);
    expect(data?.data.every((b) => b.source === 'csv')).toBe(true);
    const empty = await arclight.POST('/businesses/import', { body: { csv: 'Nama\nKlinik' } });
    expect(empty.response.status).toBe(400);
  });

  it('manages the do-not-contact list', async () => {
    const bad = await arclight.POST('/do-not-contact', { body: { kind: 'email', value: 'nope' } });
    expect(bad.response.status).toBe(400);

    const { data: entry } = await arclight.POST('/do-not-contact', {
      body: { kind: 'domain', value: 'https://www.klinik.co.id', reason: 'Asked us to stop' },
    });
    expect(entry).toMatchObject({ kind: 'domain', value: 'klinik.co.id' });

    const tracked = await arclight.POST('/businesses', {
      body: { websites: ['klinik.co.id'], source: 'csv' },
    });
    expect(tracked.data?.skipped[0]?.reason).toBe('On the do-not-contact list');

    const removed = await arclight.DELETE('/do-not-contact/{id}', {
      params: { path: { id: entry!.id } },
    });
    expect(removed.response.status).toBe(204);
    expect((await arclight.GET('/do-not-contact')).data?.data).toEqual([]);
  });

  it('records feedback and updates scoring weights', async () => {
    const { data } = await arclight.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    const id = data!.data[0]!.id;
    const rated = await arclight.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { feedback: 'good' },
    });
    expect(rated.data).toMatchObject({ feedback: 'good', status: 'new' });

    const empty = await arclight.PATCH('/businesses/{id}', { params: { path: { id } }, body: {} });
    expect(empty.response.status).toBe(400);

    const saved = await arclight.PUT('/scoring/weights', { body: { weights: { no_https: 5 } } });
    expect(saved.response.status).toBe(204);
    expect((await arclight.GET('/scoring/signals')).data?.data).toEqual([]);
  });
});

describe('hunts and briefing', () => {
  it('creates, runs, pauses and deletes a hunt', async () => {
    const created = await arclight.POST('/hunts', {
      body: { query: 'klinik gigi Surabaya', runHour: 6 },
    });
    expect(created.response.status).toBe(201);
    const hunt = created.data!;
    expect(hunt).toMatchObject({
      query: 'klinik gigi Surabaya',
      active: true,
      runHour: 6,
      maxNewPerRun: 10,
      autoDraft: false,
      leads: 0,
      lastRun: null,
    });
    expect(Date.parse(hunt.nextRunAt!)).toBeGreaterThan(Date.now());

    queued.length = 0;
    const run = await arclight.POST('/hunts/{id}/runs', { params: { path: { id: hunt.id } } });
    expect(run.response.status).toBe(201);
    expect(run.data).toMatchObject({
      status: 'succeeded',
      trigger: 'manual',
      found: 1,
      tracked: 1,
    });
    expect(queued).toHaveLength(1);

    const detail = await arclight.GET('/hunts/{id}', { params: { path: { id: hunt.id } } });
    expect(detail.data).toMatchObject({ leads: 1, runs: [{ id: run.data!.id }] });
    const leads = await arclight.GET('/businesses');
    expect(leads.data?.data[0]).toMatchObject({ placeId: 'ChIJ1', huntId: hunt.id });

    const paused = await arclight.PATCH('/hunts/{id}', {
      params: { path: { id: hunt.id } },
      body: { active: false },
    });
    expect(paused.data).toMatchObject({ active: false, nextRunAt: null });
    expect((await arclight.GET('/hunts')).data?.data).toHaveLength(1);

    const removed = await arclight.DELETE('/hunts/{id}', { params: { path: { id: hunt.id } } });
    expect(removed.response.status).toBe(204);
    expect((await arclight.GET('/hunts')).data?.data).toEqual([]);
    // The leads it found stay.
    expect((await arclight.GET('/businesses')).data?.data[0]?.huntId).toBeNull();
  });

  it('validates hunts', async () => {
    const bad = await arclight.POST('/hunts', { body: { query: 'x', runHour: 24 } });
    expect(bad.response.status).toBe(400);
    const missing = await arclight.POST('/hunts/{id}/runs', {
      params: { path: { id: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(missing.response.status).toBe(404);
  });

  it('reports failed runs without Google Places', async () => {
    const { app: bare } = createApp({ db, auditQueue });
    const bareClient = createArclightClient({
      baseUrl: 'http://arclight.test',
      apiKey: arclightKey.slice('Bearer '.length),
      fetch: (input) => Promise.resolve(bare.fetch(input as Request)),
    });
    const { data: hunt } = await bareClient.POST('/hunts', { body: { query: 'hotel Batu' } });
    const run = await bareClient.POST('/hunts/{id}/runs', { params: { path: { id: hunt!.id } } });
    expect(run.data).toMatchObject({ status: 'failed' });
    expect(run.data?.error).toMatch(/GOOGLE_API_KEY/);
  });

  it('serves the briefing', async () => {
    await arclight.POST('/businesses', { body: { websites: ['a.co.id', 'b.co.id'] } });
    const { data } = await arclight.GET('/briefing');
    expect(data).toMatchObject({
      newLeads: 2,
      readyToSendTotal: 0,
      followUpsTotal: 0,
      pipeline: { new: 2, contacted: 0 },
    });
    expect(data?.topNewLeads).toHaveLength(2);

    const later = await arclight.GET('/briefing', {
      params: { query: { since: new Date(Date.now() + 60_000).toISOString() } },
    });
    expect(later.data?.newLeads).toBe(0);
    const invalid = await arclight.GET('/briefing', { params: { query: { since: 'yesterday' } } });
    expect(invalid.response.status).toBe(400);
  });
});

describe('chat', () => {
  it('streams the answer as server-sent events', async () => {
    const res = await app.request('/v1/chat', {
      method: 'POST',
      headers: { authorization: arclightKey, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Ada lead baru?' }] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const body = await res.text();
    expect(body).toContain('event: tool\ndata: {"name":"list_leads","status":"start"}');
    expect(body).toContain('event: text\ndata: {"delta":"Belum ada lead."}');
    expect(body.indexOf('event: done')).toBeGreaterThan(body.indexOf('event: text'));
  });

  it('validates the conversation and needs a model', async () => {
    const bad = await app.request('/v1/chat', {
      method: 'POST',
      headers: { authorization: arclightKey, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'assistant', content: 'Hi' }] }),
    });
    expect(bad.status).toBe(400);
    const { app: bare } = createApp({ db, auditQueue });
    const res = await bare.request('/v1/chat', {
      method: 'POST',
      headers: { authorization: arclightKey, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    });
    expect(res.status).toBe(503);
  });
});

describe('instagram', () => {
  it('stores an Instagram account on a lead and queues an audit', async () => {
    const { data: tracked } = await arclight.POST('/businesses', {
      body: { websites: ['ig.co.id'] },
    });
    const id = tracked!.data[0]!.id;
    queued.length = 0;
    const bad = await arclight.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { instagram: 'not a handle!' },
    });
    expect(bad.response.status).toBe(400);
    await arclight.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { instagram: 'https://instagram.com/Klinik.IG' },
    });
    expect(queued).toHaveLength(1);
    const { data } = await arclight.GET('/businesses/{id}', { params: { path: { id } } });
    expect(data?.contacts).toContainEqual({
      kind: 'instagram',
      value: 'https://instagram.com/klinik.ig',
      sourceUrl: null,
    });
  });
});
