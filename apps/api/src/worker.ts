import {
  AUDIT_QUEUE,
  autoDraftAfterAudit,
  connectDatabase,
  createClaudeDraftWriter,
  createInstagramClient,
  createPageSpeedClient,
  createPlacesClient,
  createSafeFetcher,
  HUNT_TICK_QUEUE,
  pgBossAuditQueue,
  runAudit,
  runDueHunts,
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
    // Used only for hunts with automatic drafting.
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
    // Instagram Business Discovery, read through the agency's own Instagram business account.
    INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
    INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
    INSTAGRAM_GRAPH_VERSION: z.string().default('v23.0'),
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
  instagram:
    env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID
      ? createInstagramClient({
          accessToken: env.INSTAGRAM_ACCESS_TOKEN,
          accountId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
          version: env.INSTAGRAM_GRAPH_VERSION,
        })
      : undefined,
};
if (!deps.pageSpeed) {
  console.warn(
    'GOOGLE_API_KEY is not set; audits skip speed checks and Places lookups, and hunts fail.',
  );
}

const draftWriter = env.ANTHROPIC_API_KEY
  ? createClaudeDraftWriter({ model: env.ANTHROPIC_MODEL })
  : undefined;

await boss.work<AuditJob>(
  AUDIT_QUEUE,
  { localConcurrency: env.AUDIT_CONCURRENCY },
  async ([job]) => {
    if (!job) return;
    await runAudit(db, job.data.auditId, deps);
    if (draftWriter) await autoDraftAfterAudit(db, job.data.auditId, draftWriter);
  },
);
console.log(
  `Arclight worker processing "${AUDIT_QUEUE}" jobs (concurrency ${env.AUDIT_CONCURRENCY})`,
);

// Hunts: every few minutes, run the ones whose daily hour has come.
const auditQueue = pgBossAuditQueue(boss);
await boss.work(HUNT_TICK_QUEUE, async () => {
  const runs = await runDueHunts(db, { places, auditQueue });
  for (const run of runs) {
    console.log(
      run.status === 'succeeded'
        ? `Hunt ${run.huntId}: ${run.tracked} new of ${run.found} found`
        : `Hunt ${run.huntId} failed: ${run.error}`,
    );
  }
});
await boss.schedule(HUNT_TICK_QUEUE, '*/5 * * * *');

async function shutdown() {
  await boss.stop({ graceful: true });
  await close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
