import { asc, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import type { Database } from './db/client.ts';
import { audits, businesses, contactChannels, signals } from './db/schema.ts';
import type { Business } from './businesses.ts';
import { domainOfKey, findDoNotContact, samePhone } from './do-not-contact.ts';

export type Audit = typeof audits.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type ContactChannel = typeof contactChannels.$inferSelect;

/**
 * Overall priority: the geometric mean of need and capacity, so a lead only ranks high when it
 * both needs the agency's services and can afford them.
 */
export function priorityOf(needScore: number | null, capacityScore: number | null): number | null {
  if (needScore === null || capacityScore === null) return null;
  return Math.round(Math.sqrt(needScore * capacityScore));
}

export interface LeadSummary {
  business: Business;
  latestAudit: Audit | null;
  priority: number | null;
}

export interface LeadDetail extends LeadSummary {
  signals: Signal[];
  /** Contact channels, excluding any on the do-not-contact list. */
  contacts: ContactChannel[];
  /** True if the website's domain is on the do-not-contact list. */
  doNotContact: boolean;
}

/** Businesses with their most recent audit, highest priority first. */
export async function listLeads(
  db: Database,
  {
    limit = 50,
    offset = 0,
    ids,
  }: { limit?: number; offset?: number; /** Only these businesses. */ ids?: string[] } = {},
): Promise<LeadSummary[]> {
  if (ids?.length === 0) return [];

  const latest = db
    .selectDistinctOn([audits.businessId], getTableColumns(audits))
    .from(audits)
    .orderBy(audits.businessId, desc(audits.createdAt))
    .as('latest');

  const priority = sql<number | null>`round(sqrt(${latest.needScore} * ${latest.capacityScore}))`;

  const rows = await db
    .select({
      business: businesses,
      latestAudit: {
        id: latest.id,
        businessId: latest.businessId,
        status: latest.status,
        error: latest.error,
        notes: latest.notes,
        needScore: latest.needScore,
        capacityScore: latest.capacityScore,
        startedAt: latest.startedAt,
        finishedAt: latest.finishedAt,
        createdAt: latest.createdAt,
      },
    })
    .from(businesses)
    .leftJoin(latest, eq(latest.businessId, businesses.id))
    .where(ids ? inArray(businesses.id, ids) : undefined)
    .orderBy(sql`${priority} desc nulls last`, desc(businesses.createdAt), desc(businesses.id))
    .limit(limit)
    .offset(offset);

  return rows.map(({ business, latestAudit }) => ({
    business,
    // Drizzle returns null for the nested object when the left join found no audit.
    latestAudit: latestAudit ?? null,
    priority: priorityOf(latestAudit?.needScore ?? null, latestAudit?.capacityScore ?? null),
  }));
}

export async function getLead(db: Database, id: string): Promise<LeadDetail | null> {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!business) return null;

  const [latestAudit] = await db
    .select()
    .from(audits)
    .where(eq(audits.businessId, id))
    .orderBy(desc(audits.createdAt))
    .limit(1);

  const [auditSignals, contacts] = await Promise.all([
    latestAudit
      ? db
          .select()
          .from(signals)
          .where(eq(signals.auditId, latestAudit.id))
          .orderBy(desc(signals.points), asc(signals.key))
      : Promise.resolve([]),
    db
      .select()
      .from(contactChannels)
      .where(eq(contactChannels.businessId, id))
      .orderBy(asc(contactChannels.kind), asc(contactChannels.createdAt)),
  ]);

  const blocked = await findDoNotContact(db, {
    domains: [domainOfKey(business.websiteKey)].filter((d): d is string => !!d),
    emails: contacts.filter((c) => c.kind === 'email').map((c) => c.value),
    phones: contacts.filter((c) => c.kind === 'phone' || c.kind === 'whatsapp').map((c) => c.value),
  });
  const isBlocked = (c: ContactChannel) =>
    blocked.some(
      (e) =>
        (e.kind === 'email' && c.kind === 'email' && e.value === c.value.toLowerCase()) ||
        (e.kind === 'phone' &&
          (c.kind === 'phone' || c.kind === 'whatsapp') &&
          samePhone(e.value, c.value)),
    );

  return {
    business,
    doNotContact: blocked.some((e) => e.kind === 'domain'),
    latestAudit: latestAudit ?? null,
    priority: priorityOf(latestAudit?.needScore ?? null, latestAudit?.capacityScore ?? null),
    signals: auditSignals,
    contacts: contacts.filter((c) => !isBlocked(c)),
  };
}
