import {
  createApiKey,
  connectDatabase,
  runMigrations,
  schema,
  type DraftWriter,
  type PlacesClient,
} from '@jarvis/core';
import { createJarvisClient } from '@jarvis/sdk';
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
const { app } = createApp({ db, auditQueue, draftWriter, places });

// The SDK talks to the app in-process, so these tests also cover the generated client.
function client(apiKey: string) {
  return createJarvisClient({
    baseUrl: 'http://jarvis.test',
    apiKey,
    fetch: (input) => Promise.resolve(app.fetch(input as Request)),
  });
}

let jarvis = client('');
let jarvisKey = '';

beforeEach(async () => {
  await db.execute(sql`TRUNCATE api_keys, businesses, agency_profile, do_not_contact CASCADE`);
  const key = (await createApiKey(db, 'test')).key;
  jarvis = client(key);
  jarvisKey = `Bearer ${key}`;
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

describe('pipeline and drafts', () => {
  async function trackedId() {
    const { data } = await jarvis.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    return data!.data[0]!.id;
  }

  it('moves a lead through the pipeline', async () => {
    const id = await trackedId();
    const { data } = await jarvis.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { status: 'contacted' },
    });
    expect(data?.status).toBe('contacted');

    const bad = await jarvis.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { status: 'invented' as 'won' },
    });
    expect(bad.response.status).toBe(400);
  });

  it('stores the agency profile', async () => {
    const { data } = await jarvis.PATCH('/agency-profile', {
      body: { agencyName: 'Vera & Co', senderName: 'Yordan', services: 'Website' },
    });
    expect(data).toMatchObject({ agencyName: 'Vera & Co', language: 'id' });
    expect((await jarvis.GET('/agency-profile')).data?.senderName).toBe('Yordan');
  });

  it('writes drafts only when the lead is ready', async () => {
    const id = await trackedId();
    const notReady = await jarvis.POST('/businesses/{id}/drafts', { params: { path: { id } } });
    expect(notReady.response.status).toBe(409);
    expect(notReady.error?.error.message).toContain('agency profile');

    await jarvis.PATCH('/agency-profile', {
      body: { agencyName: 'Vera & Co', senderName: 'Yordan', services: 'Website' },
    });
    await db.update(schema.audits).set({ status: 'succeeded', needScore: 50, capacityScore: 50 });

    const { data, response } = await jarvis.POST('/businesses/{id}/drafts', {
      params: { path: { id } },
    });
    expect(response.status).toBe(201);
    expect(data?.data.map((d) => d.channel)).toEqual(['whatsapp', 'email']);

    const { data: lead } = await jarvis.GET('/businesses/{id}', { params: { path: { id } } });
    expect(lead?.drafts.map((d) => d.body)).toEqual(['Halo dari Vera & Co', 'Isi email']);
  });

  it('reports when no language model is configured', async () => {
    const { app: bare } = createApp({ db, auditQueue });
    const id = await trackedId();
    const res = await bare.request(`/v1/businesses/${id}/drafts`, {
      method: 'POST',
      headers: { authorization: jarvisKey },
    });
    expect(res.status).toBe(503);
  });
});

describe('week 3', () => {
  it('searches Google Places live and tracks picked places by ID', async () => {
    const search = await jarvis.GET('/places/search', { params: { query: { q: 'klinik gigi' } } });
    expect(search.data?.data[0]).toMatchObject({
      placeId: 'ChIJ1',
      businessId: null,
      ratingCount: 812,
    });

    const { data } = await jarvis.POST('/businesses/places', { body: { placeIds: ['ChIJ1'] } });
    expect(data?.created).toBe(1);
    const business = data!.data[0]!;
    expect(business).toMatchObject({ source: 'places', placeId: 'ChIJ1', websiteUrl: null });

    const again = await jarvis.GET('/places/search', { params: { query: { q: 'klinik gigi' } } });
    expect(again.data?.data[0]?.businessId).toBe(business.id);

    const live = await jarvis.GET('/businesses/{id}/place', {
      params: { path: { id: business.id } },
    });
    expect(live.data).toMatchObject({ name: 'Klinik A', phone: '+62311' });
  });

  it('imports websites from CSV', async () => {
    const { data } = await jarvis.POST('/businesses/import', {
      body: { csv: 'Nama,Website\nKlinik A,klinik-a.co.id\nKlinik B,klinik-b.co.id\n' },
    });
    expect(data?.created).toBe(2);
    expect(data?.data.every((b) => b.source === 'csv')).toBe(true);
    const empty = await jarvis.POST('/businesses/import', { body: { csv: 'Nama\nKlinik' } });
    expect(empty.response.status).toBe(400);
  });

  it('manages the do-not-contact list', async () => {
    const bad = await jarvis.POST('/do-not-contact', { body: { kind: 'email', value: 'nope' } });
    expect(bad.response.status).toBe(400);

    const { data: entry } = await jarvis.POST('/do-not-contact', {
      body: { kind: 'domain', value: 'https://www.klinik.co.id', reason: 'Asked us to stop' },
    });
    expect(entry).toMatchObject({ kind: 'domain', value: 'klinik.co.id' });

    const tracked = await jarvis.POST('/businesses', {
      body: { websites: ['klinik.co.id'], source: 'csv' },
    });
    expect(tracked.data?.skipped[0]?.reason).toBe('On the do-not-contact list');

    const removed = await jarvis.DELETE('/do-not-contact/{id}', {
      params: { path: { id: entry!.id } },
    });
    expect(removed.response.status).toBe(204);
    expect((await jarvis.GET('/do-not-contact')).data?.data).toEqual([]);
  });

  it('records feedback and updates scoring weights', async () => {
    const { data } = await jarvis.POST('/businesses', { body: { websites: ['klinik.co.id'] } });
    const id = data!.data[0]!.id;
    const rated = await jarvis.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { feedback: 'good' },
    });
    expect(rated.data).toMatchObject({ feedback: 'good', status: 'new' });

    const empty = await jarvis.PATCH('/businesses/{id}', { params: { path: { id } }, body: {} });
    expect(empty.response.status).toBe(400);

    const saved = await jarvis.PUT('/scoring/weights', { body: { weights: { no_https: 5 } } });
    expect(saved.response.status).toBe(204);
    expect((await jarvis.GET('/scoring/signals')).data?.data).toEqual([]);
  });
});
