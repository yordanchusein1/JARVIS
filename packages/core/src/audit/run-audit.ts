import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { activityLog, audits, businesses, contactChannels, signals } from '../db/schema.ts';
import { analyzePage, type PageAnalysis } from './page-checks.ts';
import { pageSpeedSignals, type PageSpeedClient } from './pagespeed.ts';
import { isAllowedByRobots } from './robots.ts';
import { UnsafeTargetError, type PageFetcher } from './safe-fetch.ts';
import type { SignalInput } from './types.ts';

export interface AuditDependencies {
  fetchPage: PageFetcher;
  /** Omit when no PageSpeed Insights API key is configured. */
  pageSpeed?: PageSpeedClient;
  countryCode?: string;
  now?: () => Date;
}

const clampScore = (points: number) => Math.max(0, Math.min(100, points));

export function sumScores(list: SignalInput[]): { needScore: number; capacityScore: number } {
  const total = (axis: SignalInput['axis']) =>
    clampScore(list.filter((s) => s.axis === axis).reduce((sum, s) => sum + s.points, 0));
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
    const websiteUrl = business.websiteUrl;
    if (!websiteUrl) throw new Error('This business has no website to audit');

    const notes: string[] = [];
    const found: SignalInput[] = [];
    let analysis: PageAnalysis | null = null;

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
      notes.push('Speed checks were skipped because no PageSpeed Insights API key is configured.');
    } else if (speedResult.status === 'fulfilled' && speedResult.value) {
      found.push(...pageSpeedSignals(speedResult.value));
    } else if (speedResult.status === 'rejected') {
      notes.push(`Speed checks failed: ${describeError(speedResult.reason)}`);
    }

    const scores = sumScores(found);

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
