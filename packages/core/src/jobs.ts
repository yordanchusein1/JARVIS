import { PgBoss } from 'pg-boss';
import type { Database } from './db/client.ts';
import { activityLog, audits } from './db/schema.ts';

export const AUDIT_QUEUE = 'audit-business';

export interface AuditJob {
  auditId: string;
}

export interface AuditQueue {
  enqueue(auditIds: string[]): Promise<void>;
}

/** Starts pg-boss, which keeps its job tables in the same PostgreSQL database. */
export async function startJobQueue(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss(databaseUrl);
  boss.on('error', (error) => console.error('Job queue error:', error));
  await boss.start();
  await boss.createQueue(AUDIT_QUEUE, { retryLimit: 2, retryDelay: 60, expireInSeconds: 300 });
  return boss;
}

export function pgBossAuditQueue(boss: PgBoss): AuditQueue {
  return {
    enqueue: async (auditIds) => {
      await Promise.all(auditIds.map((auditId) => boss.send(AUDIT_QUEUE, { auditId })));
    },
  };
}

/** Creates a queued audit for each business and hands them to the worker. */
export async function requestAudits(
  db: Database,
  queue: AuditQueue,
  businessIds: string[],
): Promise<(typeof audits.$inferSelect)[]> {
  if (businessIds.length === 0) return [];
  const created = await db
    .insert(audits)
    .values(businessIds.map((businessId) => ({ businessId })))
    .returning();
  await db.insert(activityLog).values(
    created.map((a) => ({
      businessId: a.businessId,
      action: 'audit.requested',
      details: { auditId: a.id },
    })),
  );
  await queue.enqueue(created.map((a) => a.id));
  return created;
}
