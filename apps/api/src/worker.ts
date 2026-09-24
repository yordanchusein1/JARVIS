import {
  AUDIT_QUEUE,
  connectDatabase,
  createPageSpeedClient,
  createPlacesClient,
  createSafeFetcher,
  runAudit,
  runMigrations,
  startJobQueue,
  type AuditJob,
} from '@arclight/core';
import { z } from 'zod';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    // One Google Cloud key with the PageSpeed Insights API and Places API (New) enabled.
    GOOGLE_API_KEY: z.string().optional(),
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

const places = env.GOOGLE_API_KEY ? createPlacesClient(env.GOOGLE_API_KEY) : undefined;
const deps = {
  fetchPage: createSafeFetcher(),
  pageSpeed: env.GOOGLE_API_KEY ? createPageSpeedClient(env.GOOGLE_API_KEY) : undefined,
  getPlace: places ? (placeId: string) => places.getPlace(placeId) : undefined,
  countryCode: env.DEFAULT_COUNTRY_CODE,
};
if (!deps.pageSpeed) {
  console.warn('GOOGLE_API_KEY is not set; audits skip speed checks and Places lookups.');
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
  `Arclight worker processing "${AUDIT_QUEUE}" jobs (concurrency ${env.AUDIT_CONCURRENCY})`,
);

async function shutdown() {
  await boss.stop({ graceful: true });
  await close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
