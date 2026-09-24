import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db/client.ts';
import { activityLog, businesses } from './db/schema.ts';
import { domainOfKey, findDoNotContact } from './do-not-contact.ts';
import { InvalidWebsiteError, normalizeWebsite } from './website.ts';

export type Business = typeof businesses.$inferSelect;

export interface SkippedWebsite {
  input: string;
  reason: string;
}

export interface TrackWebsitesResult {
  /** Businesses for the given websites, including ones that were already tracked. */
  businesses: Business[];
  /** Ids of the businesses that were newly created by this call. */
  createdIds: string[];
  skipped: SkippedWebsite[];
}

/** Starts tracking businesses from website addresses entered by a user or imported from CSV. */
export async function trackWebsites(
  db: Database,
  inputs: string[],
  source: 'url' | 'csv' = 'url',
): Promise<TrackWebsitesResult> {
  const skipped: SkippedWebsite[] = [];
  const byKey = new Map<string, string>();

  for (const input of inputs) {
    try {
      const { url, key } = normalizeWebsite(input);
      if (!byKey.has(key)) byKey.set(key, url);
    } catch (error) {
      if (!(error instanceof InvalidWebsiteError)) throw error;
      skipped.push({ input, reason: error.message });
    }
  }

  const blocked = new Set(
    (await findDoNotContact(db, { domains: [...byKey.keys()].map((k) => domainOfKey(k)!) })).map(
      (e) => e.value,
    ),
  );
  for (const [key, url] of byKey) {
    if (blocked.has(domainOfKey(key)!)) {
      byKey.delete(key);
      skipped.push({ input: url, reason: 'On the do-not-contact list' });
    }
  }

  if (byKey.size === 0) return { businesses: [], createdIds: [], skipped };

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(businesses)
      .values([...byKey].map(([websiteKey, websiteUrl]) => ({ source, websiteKey, websiteUrl })))
      .onConflictDoNothing({ target: businesses.websiteKey })
      .returning({ id: businesses.id, websiteUrl: businesses.websiteUrl });

    if (created.length > 0) {
      await tx.insert(activityLog).values(
        created.map((b) => ({
          businessId: b.id,
          action: 'business.tracked',
          details: { source, websiteUrl: b.websiteUrl },
        })),
      );
    }

    const rows = await tx
      .select()
      .from(businesses)
      .where(inArray(businesses.websiteKey, [...byKey.keys()]))
      .orderBy(desc(businesses.createdAt));

    return { businesses: rows, createdIds: created.map((b) => b.id), skipped };
  });
}

export async function getBusiness(db: Database, id: string): Promise<Business | null> {
  const [row] = await db.select().from(businesses).where(eq(businesses.id, id));
  return row ?? null;
}

export type LeadStatus = Business['status'];

/** Moves a lead through the pipeline (new → contacted → replied → meeting → won/lost). */
export async function setLeadStatus(
  db: Database,
  id: string,
  status: LeadStatus,
): Promise<Business | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(businesses).where(eq(businesses.id, id));
    if (!before) return null;
    const [row] = await tx
      .update(businesses)
      .set({ status, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    if (before.status !== status) {
      await tx.insert(activityLog).values({
        businessId: id,
        action: 'status.changed',
        details: { from: before.status, to: status },
      });
    }
    return row ?? null;
  });
}

/** Starts tracking businesses picked from a Google Places search. Only the place ID is stored. */
export async function trackPlaces(db: Database, placeIds: string[]): Promise<TrackWebsitesResult> {
  const ids = [...new Set(placeIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { businesses: [], createdIds: [], skipped: [] };

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(businesses)
      .values(ids.map((placeId) => ({ source: 'places' as const, placeId })))
      .onConflictDoNothing({ target: businesses.placeId })
      .returning({ id: businesses.id });
    if (created.length > 0) {
      await tx.insert(activityLog).values(
        created.map((b) => ({
          businessId: b.id,
          action: 'business.tracked',
          details: { source: 'places' },
        })),
      );
    }
    const rows = await tx.select().from(businesses).where(inArray(businesses.placeId, ids));
    return { businesses: rows, createdIds: created.map((b) => b.id), skipped: [] };
  });
}

export type LeadFeedback = NonNullable<Business['feedback']>;

/** Records whether a person thinks this is a good lead, to calibrate scoring. */
export async function setLeadFeedback(
  db: Database,
  id: string,
  feedback: LeadFeedback | null,
): Promise<Business | null> {
  const [row] = await db
    .update(businesses)
    .set({ feedback, updatedAt: new Date() })
    .where(eq(businesses.id, id))
    .returning();
  if (row) {
    await db
      .insert(activityLog)
      .values({ businessId: id, action: 'feedback.set', details: { feedback } });
  }
  return row ?? null;
}
