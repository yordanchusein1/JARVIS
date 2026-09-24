import {
  AUDIT_QUEUE,
  connectDatabase,
  createPageSpeedClient,
  createSafeFetcher,
  runAudit,
  runMigrations,
  startJobQueue,
  type AuditJob,
} from '@jarvis/core';
import { z } from 'zod';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PAGESPEED_API_KEY: z.string().optional(),
    AUDIT_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
    DEFAULT_COUNTRY_CODE: z
      .string()
      .regex(/^\d{1,3}$/)
      .default('62'),
  })
  .parse(process.env);

await runMigrations(env.DATABASE_URL);
const { db, close } = connectDatabase(env.DATABASE_URL);
const boss = await startJobQueue(env.DATABASE_URL);

const deps = {
  fetchPage: createSafeFetcher(),
  pageSpeed: env.PAGESPEED_API_KEY ? createPageSpeedClient(env.PAGESPEED_API_KEY) : undefined,
  countryCode: env.DEFAULT_COUNTRY_CODE,
};
if (!deps.pageSpeed) {
  console.warn('PAGESPEED_API_KEY is not set; audits will skip speed checks.');
}

await boss.work<AuditJob>(
  AUDIT_QUEUE,
  { localConcurrency: env.AUDIT_CONCURRENCY },
  async ([job]) => {
    if (!job) return;
    await runAudit(db, job.data.auditId, deps);
  },
);
console.log(
  `JARVIS worker processing "${AUDIT_QUEUE}" jobs (concurrency ${env.AUDIT_CONCURRENCY})`,
);

async function shutdown() {
  await boss.stop({ graceful: true });
  await close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
