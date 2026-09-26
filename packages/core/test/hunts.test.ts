import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { updateAgencyProfile } from '../src/agency.ts';
import { getBriefing } from '../src/briefing.ts';
import { setLeadStatus, trackPlaces, trackWebsites } from '../src/businesses.ts';
import { activityLog, audits, businesses, drafts, huntRuns } from '../src/db/schema.ts';
import { addDoNotContact, samePhone } from '../src/do-not-contact.ts';
import type { DraftWriter } from '../src/drafting.ts';
import {
  autoDraftAfterAudit,
  createHunt,
  listHunts,
  runDueHunts,
  runHunt,
  updateHunt,
} from '../src/hunts.ts';
import { createPlacesClient, type PlaceSummary, type PlacesClient } from '../src/places.ts';
import { isValidTimeZone, latestSlot, nextSlot } from '../src/schedule.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;
beforeEach(() => database.reset());
afterAll(() => database.close());

const place = (placeId: string, fields: Partial<PlaceSummary> = {}): PlaceSummary => ({
  placeId,
  name: placeId,
  address: null,
  websiteUrl: `https://${placeId}.co.id/`,
  phone: null,
  rating: 4.5,
  ratingCount: 100,
  mapsUrl: null,
  ...fields,
});

function fakePlaces(results: PlaceSummary[]): PlacesClient & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    searchText: async (query) => {
      queries.push(query);
      return results;
    },
    getPlace: async () => null,
  };
}

function fakeQueue() {
  const queued: string[] = [];
  return { queued, enqueue: async (ids: string[]) => void queued.push(...ids) };
}

describe('daily slots', () => {
  it('finds the last and next local hour in a time zone', () => {
    // 07:30 in Jakarta (UTC+7).
    const now = new Date('2026-09-25T00:30:00Z');
    expect(latestSlot(now, 7, 'Asia/Jakarta').toISOString()).toBe('2026-09-25T00:00:00.000Z');
    expect(nextSlot(now, 7, 'Asia/Jakarta').toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expect(latestSlot(now, 9, 'Asia/Jakarta').toISOString()).toBe('2026-09-24T02:00:00.000Z');
    expect(nextSlot(now, 9, 'Asia/Jakarta').toISOString()).toBe('2026-09-25T02:00:00.000Z');
  });

  it('follows daylight saving time', () => {
    // New York moves from UTC-5 to UTC-4 on 8 March 2026.
    const now = new Date('2026-03-08T15:00:00Z');
    expect(latestSlot(now, 7, 'America/New_York').toISOString()).toBe('2026-03-08T11:00:00.000Z');
    expect(nextSlot(now, 7, 'America/New_York').toISOString()).toBe('2026-03-09T11:00:00.000Z');
    expect(nextSlot(new Date('2026-03-07T15:00:00Z'), 7, 'America/New_York').toISOString()).toBe(
      '2026-03-08T11:00:00.000Z',
    );
  });

  it('validates time zone names', () => {
    expect(isValidTimeZone('Asia/Makassar')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('samePhone', () => {
  it('matches a number with or without its country code', () => {
    expect(samePhone('0812-3456-7890', '+62 812 3456 7890')).toBe(true);
    expect(samePhone('6281234567890', '+6281234567890')).toBe(true);
    expect(samePhone('081234567890', '081234567891')).toBe(false);
    expect(samePhone('12345', '6212345')).toBe(false);
  });
});

describe('Places search pages', () => {
  it('follows next page tokens up to the requested number of results', async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = createPlacesClient('key', {
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        bodies.push(body);
        const page = bodies.length;
        if (page === 3) return Response.json({ error: { message: 'bad token' } }, { status: 400 });
        return Response.json({
          places: Array.from({ length: 20 }, (_, i) => ({ id: `p${page}-${i}` })),
          nextPageToken: `token-${page}`,
        });
      },
    });

    const results = await client.searchText('klinik gigi Surabaya', { maxResults: 60 });
    // The failed third page leaves the first two usable.
    expect(results).toHaveLength(40);
    expect(bodies.map((b) => b.pageToken)).toEqual([undefined, 'token-1', 'token-2']);
    expect(bodies.every((b) => b.pageSize === 20 && b.textQuery === 'klinik gigi Surabaya')).toBe(
      true,
    );
  });
});

describe('runHunt', () => {
  it('tracks the most-reviewed new businesses that pass the filters', async () => {
    await trackPlaces(db, ['tracked']);
    await trackWebsites(db, ['https://www.same-site.co.id/']);
    await addDoNotContact(db, 'domain', 'blocked.co.id');
    await addDoNotContact(db, 'phone', '0812-0000-1111');
    const places = fakePlaces([
      place('tracked'),
      place('other-listing', { websiteUrl: 'https://same-site.co.id/' }),
      place('blocked'),
      place('blocked-phone', { phone: '+6281200001111' }),
      place('few-reviews', { ratingCount: 3 }),
      place('no-site', { websiteUrl: null, ratingCount: 900 }),
      place('small', { ratingCount: 40 }),
      place('big', { ratingCount: 700 }),
      place('mid', { ratingCount: 200 }),
    ]);
    const queue = fakeQueue();
    const hunt = await createHunt(db, {
      query: '  klinik gigi Surabaya ',
      maxNewPerRun: 2,
      minReviews: 10,
      includeNoWebsite: false,
    });

    const run = await runHunt(db, { places, auditQueue: queue }, hunt.id, 'manual');

    expect(places.queries).toEqual(['klinik gigi Surabaya']);
    expect(run).toMatchObject({
      status: 'succeeded',
      trigger: 'manual',
      found: 9,
      alreadyTracked: 2,
      excluded: 4,
      tracked: 2,
    });
    expect(run.finishedAt).not.toBeNull();
    const found = await db.select().from(businesses).where(eq(businesses.huntId, hunt.id));
    expect(found.map((b) => b.placeId).sort()).toEqual(['big', 'mid']);
    // Only place IDs are stored (docs/DECISIONS.md, D3).
    expect(found.every((b) => b.websiteUrl === null && b.displayName === null)).toBe(true);
    expect(queue.queued).toHaveLength(2);

    // The next run picks up where this one stopped.
    const next = await runHunt(db, { places, auditQueue: queue }, hunt.id, 'manual');
    expect(next).toMatchObject({ alreadyTracked: 4, tracked: 1 });
  });

  it('records a failed run when Google Places is unavailable', async () => {
    const hunt = await createHunt(db, { query: 'hotel Malang' });
    const withoutKey = await runHunt(db, { auditQueue: fakeQueue() }, hunt.id, 'manual');
    expect(withoutKey).toMatchObject({ status: 'failed' });
    expect(withoutKey.error).toMatch(/GOOGLE_API_KEY/);

    const broken: PlacesClient = {
      searchText: async () => {
        throw new Error('Google Places returned HTTP 403: API not enabled');
      },
      getPlace: async () => null,
    };
    const failed = await runHunt(
      db,
      { places: broken, auditQueue: fakeQueue() },
      hunt.id,
      'manual',
    );
    expect(failed.error).toBe('Google Places returned HTTP 403: API not enabled');
  });
});

describe('scheduled hunts', () => {
  const at = (iso: string) => () => new Date(iso);

  it('runs each active hunt once per day at its local hour', async () => {
    const places = fakePlaces([place('a')]);
    const queue = fakeQueue();
    // Created at 06:00 in Jakarta, to run at 07:00.
    const hunt = await createHunt(
      db,
      { query: 'sekolah swasta Bandung', runHour: 7 },
      new Date('2026-09-24T23:00:00Z'),
    );
    const paused = await createHunt(
      db,
      { query: 'hotel Batu', runHour: 7, active: false },
      new Date('2026-09-24T23:00:00Z'),
    );

    const due = (iso: string) => runDueHunts(db, { places, auditQueue: queue, now: at(iso) });
    expect(await due('2026-09-24T23:55:00Z')).toHaveLength(0);
    const [first] = await due('2026-09-25T00:05:00Z');
    expect(first).toMatchObject({ huntId: hunt.id, trigger: 'schedule', tracked: 1 });
    expect(await due('2026-09-25T00:10:00Z')).toHaveLength(0);
    expect(await due('2026-09-26T00:01:00Z')).toHaveLength(1);

    // Resuming a paused hunt waits for its next slot instead of catching up.
    await updateHunt(db, paused.id, { active: true }, new Date('2026-09-26T05:00:00Z'));
    expect(await due('2026-09-26T05:05:00Z')).toHaveLength(0);
    expect(await due('2026-09-27T00:01:00Z')).toHaveLength(2);
  });

  it('lists hunts with their last run, next run and lead count', async () => {
    const hunt = await createHunt(db, { query: 'klinik kecantikan Surabaya' });
    await runHunt(
      db,
      { places: fakePlaces([place('a'), place('b')]), auditQueue: fakeQueue() },
      hunt.id,
      'manual',
    );
    const [summary] = await listHunts(db, { now: new Date() });
    expect(summary).toMatchObject({ leads: 2, lastRun: { tracked: 2 } });
    expect(summary!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());

    await updateHunt(db, hunt.id, { active: false });
    expect((await listHunts(db))[0]!.nextRunAt).toBeNull();
  });

  it('runs no scheduled hunts while automation is paused, and skips missed slots on resume', async () => {
    const places = fakePlaces([place('a')]);
    const hunt = await createHunt(
      db,
      { query: 'klinik gigi Malang', runHour: 7 },
      new Date('2026-09-24T23:00:00Z'),
    );
    const due = (iso: string) => runDueHunts(db, { places, auditQueue: fakeQueue(), now: at(iso) });

    await updateAgencyProfile(db, { automationPaused: true });
    expect(await due('2026-09-25T00:05:00Z')).toHaveLength(0);
    expect(places.queries).toHaveLength(0);
    expect((await listHunts(db))[0]!.nextRunAt).toBeNull();

    // A manual run still works while paused.
    const run = await runHunt(db, { places, auditQueue: fakeQueue() }, hunt.id, 'manual');
    expect(run.status).toBe('succeeded');

    await updateAgencyProfile(db, { automationPaused: false });
    expect(await due('2026-09-25T03:00:00Z')).toHaveLength(0);
    expect(await due('2026-09-26T00:05:00Z')).toHaveLength(1);
  });
});

describe('autoDraftAfterAudit', () => {
  const writer: DraftWriter = async () => ({
    whatsapp: 'Halo',
    emailSubject: 'Website',
    emailBody: 'Isi',
    model: 'test-model',
  });

  async function huntLead(scores: { needScore: number; capacityScore: number | null }) {
    const hunt = await createHunt(db, {
      query: 'klinik gigi',
      autoDraft: true,
      autoDraftMinPriority: 50,
    });
    const {
      createdIds: [businessId],
    } = await trackPlaces(db, [`place-${Math.random()}`], { huntId: hunt.id });
    const [audit] = await db
      .insert(audits)
      .values({ businessId: businessId!, status: 'succeeded', ...scores })
      .returning();
    return { businessId: businessId!, auditId: audit!.id };
  }

  it('drafts strong new leads from hunts once, and never sends anything', async () => {
    await updateAgencyProfile(db, { agencyName: 'Vera & Co', senderName: 'Y', services: 'Web' });
    const strong = await huntLead({ needScore: 80, capacityScore: 50 });
    const weak = await huntLead({ needScore: 80, capacityScore: 10 });
    const unknown = await huntLead({ needScore: 60, capacityScore: null });

    expect(await autoDraftAfterAudit(db, strong.auditId, writer)).toBe('drafted');
    expect(await autoDraftAfterAudit(db, strong.auditId, writer)).toBe('skipped');
    expect(await autoDraftAfterAudit(db, weak.auditId, writer)).toBe('skipped');
    expect(await autoDraftAfterAudit(db, unknown.auditId, writer)).toBe('skipped');
    expect(await db.select().from(drafts)).toHaveLength(2);
  });

  it('records why drafting could not happen', async () => {
    const lead = await huntLead({ needScore: 90, capacityScore: 90 });
    expect(await autoDraftAfterAudit(db, lead.auditId, writer)).toBe('failed');
    const [entry] = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'drafts.auto_failed'));
    expect(JSON.stringify(entry?.details)).toMatch(/agency profile/);
  });
});

describe('getBriefing', () => {
  it('summarises the period and lists what needs attention', async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    await updateAgencyProfile(db, { followUpDays: 3 });

    const {
      createdIds: [fresh, ready, waiting, recent, blocked],
    } = await trackWebsites(db, [
      'fresh.co.id',
      'ready.co.id',
      'waiting.co.id',
      'recent.co.id',
      'blocked.co.id',
    ]);
    await db
      .update(businesses)
      .set({ createdAt: daysAgo(10) })
      .where(eq(businesses.id, waiting!));
    await db.insert(audits).values([
      {
        businessId: fresh!,
        status: 'succeeded',
        needScore: 90,
        capacityScore: 90,
        finishedAt: now,
      },
      {
        businessId: ready!,
        status: 'succeeded',
        needScore: 40,
        capacityScore: 40,
        finishedAt: now,
      },
      { businessId: recent!, status: 'failed', finishedAt: now },
    ]);
    for (const id of [ready!, blocked!]) {
      await db
        .insert(drafts)
        .values({ businessId: id, channel: 'whatsapp', body: 'Halo', model: 'm' });
      await db.insert(activityLog).values({ businessId: id, action: 'drafts.generated' });
    }
    await addDoNotContact(db, 'domain', 'blocked.co.id');

    await setLeadStatus(db, waiting!, 'contacted');
    await db
      .update(activityLog)
      .set({ createdAt: daysAgo(5) })
      .where(eq(activityLog.businessId, waiting!));
    await setLeadStatus(db, recent!, 'contacted');

    const hunt = await createHunt(db, { query: 'klinik gigi' });
    await db.insert(huntRuns).values({ huntId: hunt.id, trigger: 'schedule', status: 'succeeded' });

    const briefing = await getBriefing(db, { now });
    expect(briefing).toMatchObject({
      newLeads: 4,
      audited: 2,
      auditsFailed: 1,
      draftsWritten: 2,
      readyToSendTotal: 1,
      followUpsTotal: 1,
      pipeline: { new: 3, contacted: 2, won: 0 },
    });
    expect(briefing.topNewLeads[0]!.business.id).toBe(fresh);
    expect(briefing.readyToSend.map((l) => l.business.id)).toEqual([ready]);
    expect(briefing.followUps.map((f) => f.lead.business.id)).toEqual([waiting]);
    expect(briefing.huntRuns).toEqual([expect.objectContaining({ query: 'klinik gigi' })]);
  });
});
