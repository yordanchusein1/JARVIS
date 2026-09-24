import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runAudit, type AuditDependencies } from '../../src/audit/run-audit.ts';
import { UnsafeTargetError, type FetchedPage } from '../../src/audit/safe-fetch.ts';
import { trackWebsites } from '../../src/businesses.ts';
import { audits, businesses } from '../../src/db/schema.ts';
import { requestAudits, type AuditQueue } from '../../src/jobs.ts';
import { getLead, listLeads } from '../../src/leads.ts';
import { setupTestDatabase } from '../db.ts';

const database = await setupTestDatabase();
const { db } = database;

beforeEach(() => database.reset());
afterAll(() => database.close());

const queued: string[] = [];
const queue: AuditQueue = { enqueue: async (ids) => void queued.push(...ids) };

const OLD_SITE = `<html><head><title>Klinik Lama</title></head><body>
  <a href="/karir">Karir</a><p>3 cabang di Surabaya</p>
  <a href="mailto:info@klinik-lama.co.id">Email</a>
  <footer>© 2018</footer></body></html>`;

function pages(map: Record<string, string>): AuditDependencies['fetchPage'] {
  return async (url): Promise<FetchedPage> => {
    const body = map[url];
    if (body === undefined)
      return { url, status: 404, body: '', headers: new Headers(), redirects: [url] };
    return { url, status: 200, body, headers: new Headers(), redirects: [url] };
  };
}

async function trackAndAudit(website: string) {
  const { createdIds } = await trackWebsites(db, [website]);
  const [audit] = await requestAudits(db, queue, createdIds);
  return { businessId: createdIds[0]!, auditId: audit!.id };
}

describe('runAudit', () => {
  it('records signals, contacts, scores and the display name', async () => {
    const { businessId, auditId } = await trackAndAudit('http://klinik-lama.co.id');
    expect(queued).toContain(auditId);

    await runAudit(db, auditId, {
      fetchPage: pages({ 'http://klinik-lama.co.id/': OLD_SITE }),
      pageSpeed: async () => ({ performanceScore: 31, lcpMs: 9100, fieldLcpMs: null }),
      now: () => new Date('2026-09-24T00:00:00Z'),
    });

    const lead = await getLead(db, businessId);
    expect(lead?.latestAudit).toMatchObject({ status: 'succeeded', notes: [] });
    expect(lead?.business.displayName).toBe('Klinik Lama');
    expect(lead?.signals.map((s) => s.key)).toEqual(
      expect.arrayContaining([
        'no_https',
        'slow_mobile',
        'slow_lcp',
        'outdated_copyright',
        'careers_page',
      ]),
    );
    // Signals are ordered by weight, so the strongest evidence comes first.
    expect(lead?.signals[0]?.points).toBeGreaterThanOrEqual(lead?.signals.at(-1)?.points ?? 0);
    expect(lead?.contacts.map((c) => c.value)).toEqual(['info@klinik-lama.co.id']);
    expect(lead?.latestAudit?.needScore).toBe(100);
    expect(lead?.priority).toBeGreaterThan(0);
  });

  it('treats an unreachable website as a need and notes skipped speed checks', async () => {
    const { businessId, auditId } = await trackAndAudit('https://klinik-mati.co.id');

    await runAudit(db, auditId, {
      fetchPage: async (url) => {
        if (url.endsWith('/robots.txt')) throw new Error('down');
        throw new Error('getaddrinfo ENOTFOUND klinik-mati.co.id');
      },
    });

    const lead = await getLead(db, businessId);
    expect(lead?.signals.map((s) => s.key)).toEqual(['unreachable']);
    expect(lead?.latestAudit?.notes).toEqual([
      'Speed checks were skipped because no PageSpeed Insights API key is configured.',
    ]);
  });

  it('skips homepage checks when robots.txt disallows them', async () => {
    const { businessId, auditId } = await trackAndAudit('https://privat.co.id');

    await runAudit(db, auditId, {
      fetchPage: pages({
        'https://privat.co.id/robots.txt': 'User-agent: *\nDisallow: /',
        'https://privat.co.id/': OLD_SITE,
      }),
    });

    const lead = await getLead(db, businessId);
    expect(lead?.latestAudit?.status).toBe('succeeded');
    expect(lead?.signals).toEqual([]);
    expect(lead?.latestAudit?.notes[0]).toContain('robots.txt');
  });

  it('fails the audit when the website points to a private address', async () => {
    const { auditId } = await trackAndAudit('https://jebakan.co.id');

    await runAudit(db, auditId, {
      fetchPage: async () => {
        throw new UnsafeTargetError('jebakan.co.id resolves to a non-public address (10.0.0.1)');
      },
    });

    const [audit] = await db.select().from(audits).where(eq(audits.id, auditId));
    expect(audit).toMatchObject({ status: 'failed', error: expect.stringContaining('non-public') });
  });
});

describe('listLeads', () => {
  it('orders leads by priority, with unaudited leads last', async () => {
    const low = await trackAndAudit('https://low.co.id');
    const high = await trackAndAudit('https://high.co.id');
    await trackWebsites(db, ['https://new.co.id']);

    await db
      .update(audits)
      .set({ status: 'succeeded', needScore: 20, capacityScore: 20 })
      .where(eq(audits.id, low.auditId));
    await db
      .update(audits)
      .set({ status: 'succeeded', needScore: 80, capacityScore: 45 })
      .where(eq(audits.id, high.auditId));

    const leads = await listLeads(db);
    expect(leads.map((l) => [l.business.websiteKey, l.priority])).toEqual([
      ['high.co.id', 60],
      ['low.co.id', 20],
      ['new.co.id', null],
    ]);
    expect(leads[2]?.latestAudit).toBeNull();
    expect(await db.select().from(businesses)).toHaveLength(3);
  });
});
