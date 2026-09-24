import { serve } from '@hono/node-server';
import { connectDatabase, pgBossAuditQueue, runMigrations, startJobQueue } from '@jarvis/core';
import { z } from 'zod';
import { createApp } from './app.ts';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().default(8787),
  })
  .parse(process.env);

await runMigrations(env.DATABASE_URL);
const { db, close } = connectDatabase(env.DATABASE_URL);
const boss = await startJobQueue(env.DATABASE_URL);

const { app } = createApp({ db, auditQueue: pgBossAuditQueue(boss) });
const server = serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`JARVIS API listening on http://localhost:${port}/v1`);
});

function shutdown() {
  server.close(async () => {
    await boss.stop();
    await close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
