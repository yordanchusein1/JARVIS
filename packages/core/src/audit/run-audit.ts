import { and, eq, isNull, ne } from 'drizzle-orm';
import { getAgencyProfile } from '../agency.ts';
import type { Database } from '../db/client.ts';
import { activityLog, audits, businesses, contactChannels, signals } from '../db/schema.ts';
import { analyzePage, type PageAnalysis } from './page-checks.ts';
import { pageSpeedSignals, type PageSpeedClient } from './pagespeed.ts';
import { isAllowedByRobots } from './robots.ts';
import { UnsafeTargetError, type PageFetcher } from './safe-fetch.ts';
import type { PlaceSummary } from '../places.ts';
import { normalizeWebsite } from '../website.ts';
import type { SignalInput } from './types.ts';

export interface AuditDependencies {
  fetchPage: PageFetcher;
  /** Omit when no PageSpeed Insights API key is configured. */
  pageSpeed?: PageSpeedClient;
  /** Looks up a Google place live. Needed for businesses added from Google Places search. */
  getPlace?: (placeId: string) => Promise<PlaceSummary | null>;
  countryCode?: string;
  now?: () => Date;
}

const clampScore = (points: number) => Math.max(0, Math.min(100, points));

/** Adds up signal points per axis; `weights` replaces the default points of a signal key. */
/**
 * Scores an audit. Without a website there is nothing to judge capacity from, so it is unknown
 * (null) rather than zero; a zero would rank established businesses without a website last.
 */
export function scoreAudit(
  list: Pick<SignalInput, 'axis' | 'key' | 'points'>[],
  weights: Record<string, number> = {},
): { needScore: number; capacityScore: number | null } {
  const scores = sumScores(list, weights);
  const noWebsite = list.some((s) => s.key === 'no_website');
  return { ...scores, capacityScore: noWebsite ? null : scores.capacityScore };
}

export function sumScores(
  list: Pick<SignalInput, 'axis' | 'key' | 'points'>[],
  weights: Record<string, number> = {},
): { needScore: number; capacityScore: number } {
  const total = (axis: SignalInput['axis']) =>
    clampScore(
      list.filter((s) => s.axis === axis).reduce((sum, s) => sum + (weights[s.key] ?? s.points), 0),
    );
  return { needScore: total('need'), capacityScore: total('capacity') };
}

/** Runs one queued audit: checks the business's website and records signals, contacts and scores. */
export async function runAudit(
  db: Database,
  auditId: string,
  deps: AuditDependencies,
): Promise<void> {
  const now = deps.now ?? (() => new Date());

  const [row] = await db
    .select({ audit: audits, business: businesses })
    .from(audits)
    .innerJoin(businesses, eq(audits.businessId, businesses.id))
    .where(eq(audits.id, auditId));
  if (!row) throw new Error(`Audit ${auditId} not found`);
  const { audit, business } = row;
  if (audit.status === 'succeeded' || audit.status === 'failed') return;

  await db
    .update(audits)
    .set({ status: 'running', startedAt: now(), error: null })
    .where(eq(audits.id, auditId));
  // A previous attempt of this audit may have been interrupted after writing signals.
  await db.delete(signals).where(eq(signals.auditId, auditId));

  try {
    const notes: string[] = [];
    const found: SignalInput[] = [];
    let analysis: PageAnalysis | null = null;
    // The address of the business's own website, confirmed by visiting it.
    let verifiedWebsite: string | null = null;

    let websiteUrl = business.websiteUrl;
    if (!websiteUrl && business.placeId) {
      if (!deps.getPlace) throw new Error('Google Places is not configured on the worker');
      // Looked up live and never stored: only the place ID may be kept (docs/DECISIONS.md, D3).
      const place = await deps.getPlace(business.placeId);
      if (!place) throw new Error('The Google place no longer exists');
      websiteUrl = place.websiteUrl;
      if (!websiteUrl) {
        found.push({
          axis: 'need',
          key: 'no_website',
          points: 60,
          evidence: 'The business has no website listed on its Google Maps profile.',
        });
      }
    }
    if (!websiteUrl && found.length === 0) throw new Error('This business has no website to audit');

    if (websiteUrl) {
      const allowed = await isAllowedByRobots(deps.fetchPage, websiteUrl);
      const [pageResult, speedResult] = await Promise.allSettled([
        allowed ? deps.fetchPage(websiteUrl) : Promise.resolve(null),
        deps.pageSpeed ? deps.pageSpeed(websiteUrl) : Promise.resolve(null),
      ]);

      if (!allowed) {
        notes.push(
          "The website's robots.txt asks automated tools not to visit it, so homepage checks were skipped.",
        );
      } else if (pageResult.status === 'fulfilled' && pageResult.value) {
        verifiedWebsite = pageResult.value.status < 400 ? pageResult.value.url : null;
        analysis = analyzePage(pageResult.value, { now: now(), countryCode: deps.countryCode });
        found.push(...analysis.signals);
      } else if (pageResult.status === 'rejected') {
        const reason = pageResult.reason as Error;
        if (reason instanceof UnsafeTargetError) throw reason;
        found.push({
          axis: 'need',
          key: 'unreachable',
          points: 40,
          evidence: 'The website could not be loaded when JARVIS visited it.',
          data: { error: describeError(reason) },
        });
      }

      if (!deps.pageSpeed) {
        notes.push('Speed checks were skipped because no Google API key is configured.');
      } else if (speedResult.status === 'fulfilled' && speedResult.value) {
        found.push(...pageSpeedSignals(speedResult.value));
      } else if (speedResult.status === 'rejected') {
        notes.push(`Speed checks failed: ${describeError(speedResult.reason)}`);
      }
    }

    const { scoringWeights } = await getAgencyProfile(db);
    const scores = scoreAudit(found, scoringWeights);

    await db.transaction(async (tx) => {
      if (found.length > 0) {
        await tx.insert(signals).values(found.map((s) => ({ ...s, auditId })));
      }
      if (analysis && analysis.contacts.length > 0) {
        await tx
          .insert(contactChannels)
          .values(analysis.contacts.map((c) => ({ ...c, businessId: business.id })))
          .onConflictDoNothing();
      }
      const verified = verifiedWebsite ? tryNormalize(verifiedWebsite) : null;
      if (verified && !business.websiteUrl) {
        const { url, key } = verified;
        // Skip if another tracked business already has this website.
        const [taken] = await tx
          .select({ id: businesses.id })
          .from(businesses)
          .where(and(eq(businesses.websiteKey, key), ne(businesses.id, business.id)));
        if (!taken) {
          await tx
            .update(businesses)
            .set({ websiteUrl: url, websiteKey: key, updatedAt: now() })
            .where(eq(businesses.id, business.id));
        }
      }
      if (analysis?.displayName) {
        await tx
          .update(businesses)
          .set({ displayName: analysis.displayName, updatedAt: now() })
          .where(and(eq(businesses.id, business.id), isNull(businesses.displayName)));
      }
      await tx
        .update(audits)
        .set({ status: 'succeeded', notes, ...scores, finishedAt: now() })
        .where(eq(audits.id, auditId));
      await tx.insert(activityLog).values({
        businessId: business.id,
        action: 'audit.succeeded',
        details: { auditId, ...scores },
      });
    });
  } catch (error) {
    await db
      .update(audits)
      .set({ status: 'failed', error: describeError(error), finishedAt: now() })
      .where(eq(audits.id, auditId));
    await db.insert(activityLog).values({
      businessId: business.id,
      action: 'audit.failed',
      details: { auditId, error: describeError(error) },
    });
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return cause?.code || cause?.message
    ? `${error.message} (${cause.code ?? cause.message})`
    : error.message;
}

function tryNormalize(url: string) {
  try {
    return normalizeWebsite(url);
  } catch {
    return null;
  }
}
