import { and, asc, count, desc, eq, gte, inArray, max, sql } from 'drizzle-orm';
import { getAgencyProfile } from './agency.ts';
import type { LeadStatus } from './businesses.ts';
import type { Database } from './db/client.ts';
import { activityLog, audits, businesses, drafts, huntRuns, hunts } from './db/schema.ts';
import { domainOfKey, findDoNotContact } from './do-not-contact.ts';
import type { HuntRun } from './hunts.ts';
import { listLeads, type LeadSummary } from './leads.ts';

export interface FollowUp {
  lead: LeadSummary;
  /** When the lead was moved to "contacted". */
  contactedAt: Date;
}

/** What happened since a point in time, and what needs a person's attention now. */
export interface Briefing {
  since: Date;
  until: Date;
  /** Businesses that started being tracked in the period. */
  newLeads: number;
  audited: number;
  auditsFailed: number;
  /** Leads that got new drafts in the period. */
  draftsWritten: number;
  /** The best leads found in the period (at most 5). */
  topNewLeads: LeadSummary[];
  /** New leads with drafts waiting to be reviewed and sent, best first (at most 5). */
  readyToSend: LeadSummary[];
  readyToSendTotal: number;
  /** Contacted leads with no reply after the agency's follow-up days, oldest first (at most 10). */
  followUps: FollowUp[];
  followUpsTotal: number;
  huntRuns: (HuntRun & { query: string })[];
  /** Leads per pipeline stage, all time. */
  pipeline: Record<LeadStatus, number>;
}

const DAY = 24 * 60 * 60 * 1000;

export async function getBriefing(
  db: Database,
  { since, now = new Date() }: { since?: Date; now?: Date } = {},
): Promise<Briefing> {
  const from = since ?? new Date(now.getTime() - DAY);
  const { followUpDays } = await getAgencyProfile(db);
  const contactedBefore = new Date(now.getTime() - followUpDays * DAY);

  const [[newLeads], auditCounts, [draftsWritten], newIds, drafted, contacted, runs, stages] =
    await Promise.all([
      db.select({ n: count() }).from(businesses).where(gte(businesses.createdAt, from)),
      db
        .select({ status: audits.status, n: count() })
        .from(audits)
        .where(and(gte(audits.finishedAt, from), inArray(audits.status, ['succeeded', 'failed'])))
        .groupBy(audits.status),
      db
        .select({ n: sql<number>`count(distinct ${activityLog.businessId})::int` })
        .from(activityLog)
        .where(and(eq(activityLog.action, 'drafts.generated'), gte(activityLog.createdAt, from))),
      db.select({ id: businesses.id }).from(businesses).where(gte(businesses.createdAt, from)),
      db
        .selectDistinct({ id: businesses.id, websiteKey: businesses.websiteKey })
        .from(businesses)
        .innerJoin(drafts, eq(drafts.businessId, businesses.id))
        .where(eq(businesses.status, 'new')),
      // A contacted lead's latest status change is the move to "contacted".
      db
        .select({ id: businesses.id, contactedAt: max(activityLog.createdAt) })
        .from(businesses)
        .innerJoin(
          activityLog,
          and(eq(activityLog.businessId, businesses.id), eq(activityLog.action, 'status.changed')),
        )
        .where(eq(businesses.status, 'contacted'))
        .groupBy(businesses.id)
        .having(sql`max(${activityLog.createdAt}) <= ${contactedBefore.toISOString()}`)
        .orderBy(asc(max(activityLog.createdAt))),
      db
        .select({ run: huntRuns, query: hunts.query })
        .from(huntRuns)
        .innerJoin(hunts, eq(huntRuns.huntId, hunts.id))
        .where(gte(huntRuns.startedAt, from))
        .orderBy(desc(huntRuns.startedAt))
        .limit(20),
      db
        .select({ status: businesses.status, n: count() })
        .from(businesses)
        .groupBy(businesses.status),
    ]);

  // Drafts can outlive a later do-not-contact request; those leads are not ready to send.
  const blockedDomains = new Set(
    (
      await findDoNotContact(db, {
        domains: drafted.map((d) => domainOfKey(d.websiteKey)).filter((d): d is string => !!d),
      })
    ).map((e) => e.value),
  );
  const readyIds = drafted
    .filter((d) => !blockedDomains.has(domainOfKey(d.websiteKey) ?? ''))
    .map((d) => d.id);

  const followUpIds = contacted.slice(0, 10).map((c) => c.id);
  const [topNewLeads, readyToSend, followUpLeads] = await Promise.all([
    listLeads(db, { ids: newIds.map((b) => b.id), limit: 5 }),
    listLeads(db, { ids: readyIds, limit: 5 }),
    listLeads(db, { ids: followUpIds, limit: 10 }),
  ]);

  const pipeline: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    replied: 0,
    meeting: 0,
    won: 0,
    lost: 0,
  };
  for (const s of stages) pipeline[s.status] = s.n;

  return {
    since: from,
    until: now,
    newLeads: newLeads?.n ?? 0,
    audited: auditCounts.find((a) => a.status === 'succeeded')?.n ?? 0,
    auditsFailed: auditCounts.find((a) => a.status === 'failed')?.n ?? 0,
    draftsWritten: draftsWritten?.n ?? 0,
    topNewLeads,
    readyToSend,
    readyToSendTotal: readyIds.length,
    followUps: contacted.slice(0, 10).flatMap((c) => {
      const lead = followUpLeads.find((l) => l.business.id === c.id);
      return lead && c.contactedAt ? [{ lead, contactedAt: c.contactedAt }] : [];
    }),
    followUpsTotal: contacted.length,
    huntRuns: runs.map(({ run, query }) => ({ ...run, query })),
    pipeline,
  };
}
