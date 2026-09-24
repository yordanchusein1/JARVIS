import { eq, inArray, sql } from 'drizzle-orm';
import { updateAgencyProfile } from './agency.ts';
import { scoreAudit } from './audit/run-audit.ts';
import type { Database } from './db/client.ts';
import { audits, businesses, signals } from './db/schema.ts';

export interface SignalInsight {
  key: string;
  axis: 'need' | 'capacity';
  /** Points the audit assigns by default. */
  defaultPoints: number;
  /** Points currently used, after the agency's overrides. */
  points: number;
  /** Leads whose latest audit found this signal. */
  leads: number;
  good: number;
  bad: number;
}

/** For every signal seen so far: how often it occurs, and on leads rated 👍 or 👎. */
export async function signalInsights(
  db: Database,
  weights: Record<string, number>,
): Promise<SignalInsight[]> {
  const rows = await db.execute<{
    key: string;
    axis: 'need' | 'capacity';
    default_points: number;
    leads: number;
    good: number;
    bad: number;
  }>(sql`
    with latest as (
      select distinct on (business_id) id, business_id from ${audits}
      where status = 'succeeded'
      order by business_id, created_at desc
    )
    select s.key, s.axis, max(s.points)::int as default_points,
      count(distinct l.business_id)::int as leads,
      count(distinct l.business_id) filter (where b.feedback = 'good')::int as good,
      count(distinct l.business_id) filter (where b.feedback = 'bad')::int as bad
    from ${signals} s
    join latest l on l.id = s.audit_id
    join ${businesses} b on b.id = l.business_id
    group by s.key, s.axis
    order by s.axis desc, max(s.points) desc, s.key`);

  return rows.map((r) => ({
    key: r.key,
    axis: r.axis,
    defaultPoints: r.default_points,
    points: weights[r.key] ?? r.default_points,
    leads: r.leads,
    good: r.good,
    bad: r.bad,
  }));
}

/** Saves new signal weights and recalculates the scores of every finished audit. */
export async function updateScoringWeights(
  db: Database,
  weights: Record<string, number>,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(weights).filter(([, v]) => Number.isInteger(v) && v >= 0 && v <= 100),
  );
  await updateAgencyProfile(db, { scoringWeights: clean });

  const finished = await db
    .select({ id: audits.id })
    .from(audits)
    .where(eq(audits.status, 'succeeded'));
  if (finished.length === 0) return;

  const rows = await db
    .select({
      auditId: signals.auditId,
      axis: signals.axis,
      key: signals.key,
      points: signals.points,
    })
    .from(signals)
    .where(
      inArray(
        signals.auditId,
        finished.map((a) => a.id),
      ),
    );

  const byAudit = new Map<string, typeof rows>();
  for (const a of finished) byAudit.set(a.id, []);
  for (const row of rows) byAudit.get(row.auditId)!.push(row);

  await db.transaction(async (tx) => {
    for (const [auditId, list] of byAudit) {
      await tx.update(audits).set(scoreAudit(list, clean)).where(eq(audits.id, auditId));
    }
  });
}
