import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db/client.ts';
import { activityLog, businesses } from './db/schema.ts';
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
