import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runAudit } from '../src/audit/run-audit.ts';
import { InvalidInstagramError, setLeadInstagram, trackPlaces } from '../src/businesses.ts';
import { contactChannels } from '../src/db/schema.ts';
import {
  createInstagramClient,
  instagramSignals,
  instagramUsername,
  type InstagramClient,
} from '../src/instagram.ts';
import { requestAudits } from '../src/jobs.ts';
import { getLead } from '../src/leads.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;
beforeEach(() => database.reset());
afterAll(() => database.close());

describe('instagramUsername', () => {
  it('reads handles and profile links', () => {
    expect(instagramUsername('https://www.instagram.com/Klinik.Senyum/')).toBe('klinik.senyum');
    expect(instagramUsername('@klinik_senyum')).toBe('klinik_senyum');
    expect(instagramUsername('instagram.com/klinik')).toBe('klinik');
    expect(instagramUsername('https://instagram.com/p/Cx12ab')).toBeNull();
    expect(instagramUsername('not a handle!')).toBeNull();
  });
});

describe('Instagram client', () => {
  it('asks Business Discovery for the public numbers', async () => {
    let requested = '';
    const client = createInstagramClient({
      accessToken: 'token',
      accountId: '1784',
      fetchImpl: async (url) => {
        requested = String(url);
        return Response.json({
          business_discovery: {
            username: 'klinik.senyum',
            followers_count: 12400,
            media_count: 310,
            media: { data: [{ timestamp: '2026-09-20T03:00:00+0000' }] },
          },
        });
      },
    });
    const profile = await client.businessDiscovery('klinik.senyum');
    expect(requested).toContain(
      'https://graph.facebook.com/v23.0/1784?fields=business_discovery.username',
    );
    expect(decodeURIComponent(requested)).toContain('username(klinik.senyum)');
    expect(profile).toEqual({
      username: 'klinik.senyum',
      followers: 12400,
      posts: 310,
      lastPostAt: new Date('2026-09-20T03:00:00Z'),
    });
  });

  it('returns null for personal accounts and throws on other errors', async () => {
    const answer = (body: object, status = 400) =>
      createInstagramClient({
        accessToken: 't',
        accountId: '1',
        fetchImpl: async () => Response.json(body, { status }),
      });
    expect(
      await answer({ error: { code: 110, error_subcode: 2207013 } }).businessDiscovery('x'),
    ).toBeNull();
    await expect(
      answer({ error: { code: 190, message: 'Invalid OAuth access token' } }).businessDiscovery(
        'x',
      ),
    ).rejects.toThrow('Invalid OAuth access token');
  });
});

describe('instagramSignals', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  it('turns followers and recent posts into capacity', () => {
    const signals = instagramSignals(
      { username: 'a', followers: 12400, posts: 300, lastPostAt: new Date('2026-09-20T00:00:00Z') },
      now,
    );
    expect(signals.map((s) => [s.key, s.axis, s.points])).toEqual([
      ['instagram_followers', 'capacity', 25],
      ['instagram_active', 'capacity', 10],
    ]);
    expect(signals[0]!.evidence).toBe('Has 12,400 followers on Instagram (@a).');
    expect(signals[1]!.evidence).toContain('5 days ago');
  });

  it('treats an abandoned account as a need', () => {
    const [signal] = instagramSignals(
      { username: 'a', followers: 80, posts: 3, lastPostAt: new Date('2025-09-01T00:00:00Z') },
      now,
    );
    expect(signal).toMatchObject({ key: 'instagram_inactive', axis: 'need' });
    expect(signal!.evidence).toContain('12 months');
  });
});

describe('Instagram in audits', () => {
  it('gives a business without a website a capacity from its Instagram', async () => {
    const {
      createdIds: [id],
    } = await trackPlaces(db, ['noSite']);
    await expect(setLeadInstagram(db, id!, 'https://instagram.com/p/x')).rejects.toBeInstanceOf(
      InvalidInstagramError,
    );
    await setLeadInstagram(db, id!, '@Klinik.Ceria');
    const instagram: InstagramClient = {
      businessDiscovery: async (username) => ({
        username,
        followers: 5200,
        posts: 120,
        lastPostAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }),
    };
    const [audit] = await requestAudits(db, { enqueue: async () => {} }, [id!]);
    await runAudit(db, audit!.id, {
      fetchPage: async () => {
        throw new Error('no website to fetch');
      },
      getPlace: async (placeId) => ({
        placeId,
        name: 'Klinik Ceria',
        address: null,
        websiteUrl: null,
        phone: null,
        rating: 4.6,
        ratingCount: 300,
        mapsUrl: null,
      }),
      instagram,
    });
    const lead = await getLead(db, id!);
    expect(lead?.signals.map((s) => s.key).sort()).toEqual([
      'instagram_active',
      'instagram_followers',
      'no_website',
    ]);
    expect(lead?.latestAudit).toMatchObject({ needScore: 60, capacityScore: 25 });
    expect(lead?.priority).toBe(39);

    // Removing it leaves the other contacts alone.
    await setLeadInstagram(db, id!, null);
    expect(
      await db.select().from(contactChannels).where(eq(contactChannels.businessId, id!)),
    ).toEqual([]);
  });

  it('notes when Instagram access is missing', async () => {
    const {
      createdIds: [id],
    } = await trackPlaces(db, ['noSite2']);
    await setLeadInstagram(db, id!, 'klinik');
    const [audit] = await requestAudits(db, { enqueue: async () => {} }, [id!]);
    await runAudit(db, audit!.id, {
      fetchPage: async () => {
        throw new Error('unused');
      },
      getPlace: async (placeId) => ({
        placeId,
        name: null,
        address: null,
        websiteUrl: null,
        phone: null,
        rating: null,
        ratingCount: null,
        mapsUrl: null,
      }),
    });
    const lead = await getLead(db, id!);
    expect(lead?.latestAudit?.notes).toContain(
      'Instagram checks were skipped because no Instagram access is configured.',
    );
    expect(lead?.latestAudit?.capacityScore).toBeNull();
  });
});
