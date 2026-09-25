import { and, count, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { getAgencyProfile } from './agency.ts';
import { trackPlaces } from './businesses.ts';
import type { Database } from './db/client.ts';
import { activityLog, audits, businesses, drafts, huntRuns, hunts } from './db/schema.ts';
import { domainOfKey, findDoNotContact, samePhone } from './do-not-contact.ts';
import { generateDrafts, type DraftWriter } from './drafting.ts';
import { requestAudits, type AuditQueue } from './jobs.ts';
import { priorityOf } from './leads.ts';
import type { PlaceSummary, PlacesClient } from './places.ts';
import { latestSlot, nextSlot } from './schedule.ts';
import { normalizeWebsite } from './website.ts';

export type Hunt = typeof hunts.$inferSelect;
export type HuntRun = typeof huntRuns.$inferSelect;

/** What a person can set on a hunt. */
export type HuntSettings = Pick<
  Hunt,
  | 'query'
  | 'active'
  | 'runHour'
  | 'maxNewPerRun'
  | 'minReviews'
  | 'includeNoWebsite'
  | 'autoDraft'
  | 'autoDraftMinPriority'
>;

export interface HuntSummary {
  hunt: Hunt;
  lastRun: HuntRun | null;
  /** When the next scheduled run is due (possibly already passed); null while paused. */
  nextRunAt: Date | null;
  /** Businesses this hunt has found so far. */
  leads: number;
}

export interface HuntDependencies {
  /** Omit when no Google API key is configured; runs then fail with an explanation. */
  places?: PlacesClient;
  auditQueue: AuditQueue;
  now?: () => Date;
}

/** Google returns at most 60 places for a search (3 pages of 20). */
const MAX_PLACES_PER_SEARCH = 60;

export async function createHunt(
  db: Database,
  settings: Pick<HuntSettings, 'query'> & Partial<HuntSettings>,
  now = new Date(),
): Promise<Hunt> {
  const { timezone } = await getAgencyProfile(db);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(hunts)
      .values({ ...settings, query: settings.query.trim() })
      .returning();
    // The first scheduled run is the next time the clock reaches the hunt's hour.
    const [scheduled] = await tx
      .update(hunts)
      .set({ lastScheduledFor: latestSlot(now, row!.runHour, timezone) })
      .where(eq(hunts.id, row!.id))
      .returning();
    return scheduled!;
  });
}

export async function updateHunt(
  db: Database,
  id: string,
  update: Partial<HuntSettings>,
  now = new Date(),
): Promise<Hunt | null> {
  const [before] = await db.select().from(hunts).where(eq(hunts.id, id));
  if (!before) return null;

  const values: Partial<Hunt> = { ...update, updatedAt: now };
  if (update.query !== undefined) values.query = update.query.trim();
  // A resumed or re-timed hunt waits for its next slot instead of catching up on missed ones.
  const resumed = update.active === true && !before.active;
  const retimed = update.runHour !== undefined && update.runHour !== before.runHour;
  if (resumed || retimed) {
    const { timezone } = await getAgencyProfile(db);
    const slot = latestSlot(now, update.runHour ?? before.runHour, timezone);
    values.lastScheduledFor =
      before.lastScheduledFor && before.lastScheduledFor > slot ? before.lastScheduledFor : slot;
  }
  const [row] = await db.update(hunts).set(values).where(eq(hunts.id, id)).returning();
  return row ?? null;
}

/** Deletes a hunt and its run history. Businesses it found stay tracked. */
export async function deleteHunt(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(hunts).where(eq(hunts.id, id)).returning({ id: hunts.id });
  return deleted.length > 0;
}

function nextRunOf(hunt: Hunt, timezone: string, now: Date): Date | null {
  if (!hunt.active) return null;
  const slot = latestSlot(now, hunt.runHour, timezone);
  if (!hunt.lastScheduledFor || hunt.lastScheduledFor < slot) return slot;
  return nextSlot(now, hunt.runHour, timezone);
}

export async function listHunts(
  db: Database,
  { ids, now = new Date() }: { ids?: string[]; now?: Date } = {},
): Promise<HuntSummary[]> {
  if (ids?.length === 0) return [];
  const { timezone } = await getAgencyProfile(db);
  const rows = await db
    .select()
    .from(hunts)
    .where(ids ? inArray(hunts.id, ids) : undefined)
    .orderBy(desc(hunts.createdAt));
  if (rows.length === 0) return [];
  const huntIds = rows.map((h) => h.id);

  const [lastRuns, leadCounts] = await Promise.all([
    db
      .selectDistinctOn([huntRuns.huntId])
      .from(huntRuns)
      .where(inArray(huntRuns.huntId, huntIds))
      .orderBy(huntRuns.huntId, desc(huntRuns.startedAt)),
    db
      .select({ huntId: businesses.huntId, leads: count() })
      .from(businesses)
      .where(inArray(businesses.huntId, huntIds))
      .groupBy(businesses.huntId),
  ]);

  return rows.map((hunt) => ({
    hunt,
    lastRun: lastRuns.find((r) => r.huntId === hunt.id) ?? null,
    nextRunAt: nextRunOf(hunt, timezone, now),
    leads: leadCounts.find((c) => c.huntId === hunt.id)?.leads ?? 0,
  }));
}

export async function listHuntRuns(db: Database, huntId: string, limit = 10): Promise<HuntRun[]> {
  return db
    .select()
    .from(huntRuns)
    .where(eq(huntRuns.huntId, huntId))
    .orderBy(desc(huntRuns.startedAt))
    .limit(limit);
}

export class HuntNotFoundError extends Error {
  override name = 'HuntNotFoundError';
}

interface Selection {
  chosen: PlaceSummary[];
  alreadyTracked: number;
  excluded: number;
}

/**
 * Picks the places a hunt should start tracking. Review counts are used live to rank and filter
 * and are never stored (docs/DECISIONS.md, D9).
 */
async function selectPlaces(db: Database, hunt: Hunt, places: PlaceSummary[]): Promise<Selection> {
  if (places.length === 0) return { chosen: [], alreadyTracked: 0, excluded: 0 };
  const keyOf = new Map<string, string>();
  for (const p of places) {
    try {
      if (p.websiteUrl) keyOf.set(p.placeId, normalizeWebsite(p.websiteUrl).key);
    } catch {
      // An unusable website address is treated like no website.
    }
  }
  const keys = [...new Set(keyOf.values())];
  const placeIds = places.map((p) => p.placeId);

  const [tracked, blocked] = await Promise.all([
    db
      .select({ placeId: businesses.placeId, websiteKey: businesses.websiteKey })
      .from(businesses)
      .where(
        or(
          inArray(businesses.placeId, placeIds),
          keys.length ? inArray(businesses.websiteKey, keys) : undefined,
        ),
      ),
    findDoNotContact(db, {
      domains: keys.map((k) => domainOfKey(k)!),
      phones: places.map((p) => p.phone).filter((p): p is string => !!p),
    }),
  ]);
  const trackedPlaces = new Set(tracked.map((t) => t.placeId));
  const trackedKeys = new Set(tracked.map((t) => t.websiteKey));

  let alreadyTracked = 0;
  let excluded = 0;
  const eligible: PlaceSummary[] = [];
  for (const place of places) {
    const key = keyOf.get(place.placeId);
    if (trackedPlaces.has(place.placeId) || (key && trackedKeys.has(key))) {
      alreadyTracked++;
      continue;
    }
    const onList = blocked.some(
      (e) =>
        (e.kind === 'domain' && !!key && e.value === domainOfKey(key)) ||
        (e.kind === 'phone' && !!place.phone && samePhone(e.value, place.phone)),
    );
    if (onList || (place.ratingCount ?? 0) < hunt.minReviews || (!hunt.includeNoWebsite && !key)) {
      excluded++;
      continue;
    }
    eligible.push(place);
  }

  // Most-reviewed first: a rough, live-only sign that a business is established.
  eligible.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  return { chosen: eligible.slice(0, hunt.maxNewPerRun), alreadyTracked, excluded };
}

/**
 * Runs a hunt once: searches Google Places live, starts tracking the best new businesses and
 * queues their audits. The run is recorded, including when it fails.
 */
export async function runHunt(
  db: Database,
  deps: HuntDependencies,
  huntId: string,
  trigger: HuntRun['trigger'],
): Promise<HuntRun> {
  const now = deps.now ?? (() => new Date());
  const [hunt] = await db.select().from(hunts).where(eq(hunts.id, huntId));
  if (!hunt) throw new HuntNotFoundError(`Hunt ${huntId} not found`);

  const [run] = await db.insert(huntRuns).values({ huntId, trigger, startedAt: now() }).returning();
  const finish = async (values: Partial<HuntRun>) => {
    const [row] = await db
      .update(huntRuns)
      .set({ ...values, finishedAt: now() })
      .where(eq(huntRuns.id, run!.id))
      .returning();
    return row!;
  };

  try {
    if (!deps.places) {
      throw new Error('Google Places is not configured. Set GOOGLE_API_KEY to run hunts.');
    }
    const found = await deps.places.searchText(hunt.query, { maxResults: MAX_PLACES_PER_SEARCH });
    const { chosen, alreadyTracked, excluded } = await selectPlaces(db, hunt, found);
    const { createdIds } = await trackPlaces(
      db,
      chosen.map((p) => p.placeId),
      { huntId },
    );
    await requestAudits(db, deps.auditQueue, createdIds);
    return await finish({
      status: 'succeeded',
      found: found.length,
      alreadyTracked,
      excluded,
      tracked: createdIds.length,
    });
  } catch (error) {
    return finish({
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Runs every active hunt whose daily slot has come. Safe to call often and from several
 * workers at once: each slot is claimed by one caller.
 */
export async function runDueHunts(db: Database, deps: HuntDependencies): Promise<HuntRun[]> {
  const now = (deps.now ?? (() => new Date()))();
  const { timezone } = await getAgencyProfile(db);
  const active = await db.select().from(hunts).where(eq(hunts.active, true));

  const runs: HuntRun[] = [];
  for (const hunt of active) {
    const slot = latestSlot(now, hunt.runHour, timezone);
    const claimed = await db
      .update(hunts)
      .set({ lastScheduledFor: slot })
      .where(
        and(
          eq(hunts.id, hunt.id),
          eq(hunts.active, true),
          or(isNull(hunts.lastScheduledFor), lt(hunts.lastScheduledFor, slot)),
        ),
      )
      .returning({ id: hunts.id });
    if (claimed.length > 0) runs.push(await runHunt(db, deps, hunt.id, 'schedule'));
  }
  return runs;
}

/**
 * After an audit, writes drafts for a lead found by a hunt with automatic drafting, when the
 * lead is new, has no drafts yet and reaches the hunt's priority threshold. Drafts are never
 * sent; they wait for a person to review them.
 */
export async function autoDraftAfterAudit(
  db: Database,
  auditId: string,
  writer: DraftWriter,
): Promise<'drafted' | 'skipped' | 'failed'> {
  const [row] = await db
    .select({ audit: audits, business: businesses, hunt: hunts })
    .from(audits)
    .innerJoin(businesses, eq(audits.businessId, businesses.id))
    .innerJoin(hunts, eq(businesses.huntId, hunts.id))
    .where(eq(audits.id, auditId));
  if (!row?.hunt.autoDraft || row.audit.status !== 'succeeded' || row.business.status !== 'new') {
    return 'skipped';
  }
  const priority = priorityOf(row.audit.needScore, row.audit.capacityScore);
  if (priority === null || priority < row.hunt.autoDraftMinPriority) return 'skipped';

  const [existing] = await db
    .select({ id: drafts.id })
    .from(drafts)
    .where(eq(drafts.businessId, row.business.id))
    .limit(1);
  if (existing) return 'skipped';

  try {
    await generateDrafts(db, row.business.id, writer);
    return 'drafted';
  } catch (error) {
    await db.insert(activityLog).values({
      businessId: row.business.id,
      action: 'drafts.auto_failed',
      details: { auditId, error: error instanceof Error ? error.message : String(error) },
    });
    return 'failed';
  }
}
