import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAgencyProfile, updateAgencyProfile } from '../src/agency.ts';
import { runAudit } from '../src/audit/run-audit.ts';
import type { FetchedPage } from '../src/audit/safe-fetch.ts';
import { setLeadFeedback, trackPlaces, trackWebsites } from '../src/businesses.ts';
import { websitesFromCsv } from '../src/csv.ts';
import { audits, businesses, contactChannels } from '../src/db/schema.ts';
import {
  addDoNotContact,
  InvalidDoNotContactError,
  listDoNotContact,
  normalizeDoNotContact,
} from '../src/do-not-contact.ts';
import { DraftingNotReadyError, generateDrafts } from '../src/drafting.ts';
import { requestAudits } from '../src/jobs.ts';
import { getLead } from '../src/leads.ts';
import { createPlacesClient, type PlaceSummary } from '../src/places.ts';
import { signalInsights, updateScoringWeights } from '../src/scoring.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;
beforeEach(() => database.reset());
afterAll(() => database.close());

const queue = { enqueue: async () => {} };
const page = (url: string, body: string): FetchedPage => ({
  url,
  status: 200,
  body,
  headers: new Headers(),
  redirects: [url],
});

describe('websitesFromCsv', () => {
  it('uses the website column when there is one', () => {
    const csv =
      'Nama;Website;Email\n"Klinik A; Pusat";klinik-a.co.id;a@x.id\nKlinik B;https://b.com;\n';
    expect(websitesFromCsv(csv)).toEqual(['klinik-a.co.id', 'https://b.com']);
  });

  it('otherwise picks cells that look like websites', () => {
    expect(websitesFromCsv('﻿klinik-a.co.id,info@a.id,"Jl. Mawar 1, Surabaya"\nb.com,x,y')).toEqual(
      ['klinik-a.co.id', 'b.com'],
    );
  });
});

describe('Places client', () => {
  it('sends a field-masked text search and parses places', async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const client = createPlacesClient('key-1', {
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return Response.json({
          places: [
            {
              id: 'ChIJ1',
              displayName: { text: 'Klinik Gigi A' },
              websiteUri: 'https://a.co.id/',
              internationalPhoneNumber: '+62 31-555-1234',
              rating: 4.8,
              userRatingCount: 812,
            },
          ],
        });
      },
    });

    const places = await client.searchText('klinik gigi Surabaya');
    expect(request?.url).toBe('https://places.googleapis.com/v1/places:searchText');
    const headers = new Headers(request?.init?.headers);
    expect(headers.get('x-goog-api-key')).toBe('key-1');
    expect(headers.get('x-goog-fieldmask')).toContain('places.websiteUri');
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      textQuery: 'klinik gigi Surabaya',
    });
    expect(places[0]).toMatchObject({
      placeId: 'ChIJ1',
      name: 'Klinik Gigi A',
      phone: '+62315551234',
      ratingCount: 812,
    });
  });
});

describe('Places leads', () => {
  const places: Record<string, PlaceSummary> = {
    withSite: {
      placeId: 'withSite',
      name: 'Klinik A',
      address: null,
      websiteUrl: 'https://klinik-a.co.id/',
      phone: null,
      rating: 4.7,
      ratingCount: 300,
      mapsUrl: null,
    },
    noSite: {
      placeId: 'noSite',
      name: 'Klinik B',
      address: null,
      websiteUrl: null,
      phone: '+62311',
      rating: 4.5,
      ratingCount: 90,
      mapsUrl: null,
    },
  };
  const getPlace = async (id: string) => places[id] ?? null;

  it('stores only the place ID, then saves the website once it has been visited', async () => {
    const { createdIds } = await trackPlaces(db, ['withSite', 'noSite', 'withSite']);
    expect(createdIds).toHaveLength(2);
    const stored = await db.select().from(businesses);
    expect(stored.every((b) => b.websiteUrl === null && b.displayName === null)).toBe(true);

    const [withSiteAudit, noSiteAudit] = await requestAudits(db, queue, createdIds);
    const fetchPage = async (url: string) =>
      url.endsWith('robots.txt')
        ? { ...page(url, ''), status: 404 }
        : page(url, '<html><head><title>Klinik A</title></head><body>© 2026</body></html>');
    await runAudit(db, withSiteAudit!.id, { fetchPage, getPlace });
    await runAudit(db, noSiteAudit!.id, { fetchPage, getPlace });

    const a = await getLead(db, withSiteAudit!.businessId);
    expect(a?.business).toMatchObject({
      websiteUrl: 'https://klinik-a.co.id/',
      displayName: 'Klinik A',
      placeId: 'withSite',
    });
    const b = await getLead(db, noSiteAudit!.businessId);
    expect(b?.business.websiteUrl).toBeNull();
    expect(b?.signals.map((s) => s.key)).toEqual(['no_website']);
    expect(b?.latestAudit).toMatchObject({ needScore: 60, capacityScore: null });
  });
});

describe('do-not-contact', () => {
  it('normalises entries', () => {
    expect(normalizeDoNotContact('domain', 'https://WWW.Klinik.co.id/kontak')).toBe('klinik.co.id');
    expect(normalizeDoNotContact('domain', 'http://klinik.co.id:8080/')).toBe('klinik.co.id');
    expect(normalizeDoNotContact('phone', '+62 812-3456-7890')).toBe('6281234567890');
    expect(() => normalizeDoNotContact('email', 'nope')).toThrow(InvalidDoNotContactError);
  });

  it('blocks tracking, hides listed contacts and refuses drafts', async () => {
    await addDoNotContact(db, 'domain', 'blocked.co.id', 'Asked us to stop');
    const tracked = await trackWebsites(db, ['https://www.blocked.co.id/', 'ok.co.id']);
    expect(tracked.skipped).toEqual([
      { input: 'https://www.blocked.co.id/', reason: 'On the do-not-contact list' },
    ]);

    const okId = tracked.createdIds[0]!;
    await db.insert(contactChannels).values([
      { businessId: okId, kind: 'email', value: 'owner@ok.co.id' },
      { businessId: okId, kind: 'whatsapp', value: '+6281234567890' },
    ]);
    await addDoNotContact(db, 'phone', '0812-3456-7890'.replace(/^0/, '62'));
    expect((await getLead(db, okId))?.contacts.map((c) => c.value)).toEqual(['owner@ok.co.id']);

    await addDoNotContact(db, 'domain', 'ok.co.id');
    expect((await getLead(db, okId))?.doNotContact).toBe(true);
    await updateAgencyProfile(db, { agencyName: 'A', senderName: 'B', services: 'C' });
    await db.insert(audits).values({ businessId: okId, status: 'succeeded' });
    await expect(
      generateDrafts(db, okId, async () => ({
        whatsapp: '',
        emailSubject: '',
        emailBody: '',
        model: '',
      })),
    ).rejects.toBeInstanceOf(DraftingNotReadyError);
    expect(await listDoNotContact(db)).toHaveLength(3);
  });
});

describe('feedback and weights', () => {
  it('reports signals by feedback and rescores audits when weights change', async () => {
    const { createdIds } = await trackWebsites(db, ['a.co.id', 'b.co.id']);
    const [a, b] = await requestAudits(db, queue, createdIds);
    const site = page('http://a.co.id/', '<html><body><a href="/karir">Karir</a></body></html>');
    for (const audit of [a!, b!]) {
      await runAudit(db, audit.id, {
        fetchPage: async (url) =>
          url.endsWith('robots.txt') ? { ...site, status: 404 } : { ...site, url },
      });
    }
    await setLeadFeedback(db, a!.businessId, 'good');
    await setLeadFeedback(db, b!.businessId, 'bad');

    const before = await signalInsights(db, {});
    expect(before.find((s) => s.key === 'no_viewport')).toMatchObject({
      axis: 'need',
      defaultPoints: 20,
      leads: 2,
      good: 1,
      bad: 1,
    });

    const [auditBefore] = await db.select().from(audits).where(eq(audits.id, a!.id));
    await updateScoringWeights(db, { no_viewport: 0, careers_page: 50, bogus: 500 });
    const [auditAfter] = await db.select().from(audits).where(eq(audits.id, a!.id));

    expect(auditAfter!.needScore).toBe(auditBefore!.needScore! - 20);
    expect(auditAfter!.capacityScore).toBe(auditBefore!.capacityScore! + 30);
    expect((await getAgencyProfile(db)).scoringWeights).toEqual({
      no_viewport: 0,
      careers_page: 50,
    });
  });
});
