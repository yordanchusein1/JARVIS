import { serve } from '@hono/node-server';
import {
  connectDatabase,
  createClaudeChatModel,
  createClaudeDraftWriter,
  createGeminiChatModel,
  createGeminiDraftWriter,
  createPlacesClient,
  pgBossAuditQueue,
  runMigrations,
  startJobQueue,
} from '@arclight/core';
import { z } from 'zod';
import { createApp } from './app.ts';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().default(8787),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
    // Used when ANTHROPIC_API_KEY is not set.
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
  })
  .parse(process.env);

await runMigrations(env.DATABASE_URL);
const { db, close } = connectDatabase(env.DATABASE_URL);
const boss = await startJobQueue(env.DATABASE_URL);

const gemini = env.GEMINI_API_KEY ? { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL } : null;
const draftWriter = env.ANTHROPIC_API_KEY
  ? createClaudeDraftWriter({ model: env.ANTHROPIC_MODEL })
  : gemini
    ? createGeminiDraftWriter(gemini)
    : undefined;
if (!draftWriter) {
  console.warn(
    'Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set; drafting and chat are disabled.',
  );
}

const places = env.GOOGLE_API_KEY ? createPlacesClient(env.GOOGLE_API_KEY) : undefined;
if (!places) console.warn('GOOGLE_API_KEY is not set; Google Places search is disabled.');

const chatModel = env.ANTHROPIC_API_KEY
  ? createClaudeChatModel({ model: env.ANTHROPIC_MODEL })
  : gemini
    ? createGeminiChatModel(gemini)
    : undefined;

const { app } = createApp({
  db,
  auditQueue: pgBossAuditQueue(boss),
  draftWriter,
  places,
  chatModel,
});
const server = serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`Arclight API listening on http://localhost:${port}/v1`);
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
