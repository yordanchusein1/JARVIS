import { createRoute, z } from '@hono/zod-openapi';
import {
  verifyApiKey,
  type AuditQueue,
  type ChatModel,
  type Database,
  type DraftWriter,
  type PlacesClient,
} from '@arclight/core';
import { createMiddleware } from 'hono/factory';
import { createRouter, type AppEnv } from './router.ts';
import { agencyRoutes } from './routes/agency.ts';
import { briefingRoutes } from './routes/briefing.ts';
import { chatRoutes } from './routes/chat.ts';
import { businessRoutes } from './routes/businesses.ts';
import { huntRoutes } from './routes/hunts.ts';
import { placesRoutes } from './routes/places.ts';
import { settingsRoutes } from './routes/settings.ts';

export interface AppDependencies {
  db: Database;
  auditQueue: AuditQueue;
  /** Omit when no language model is configured; drafting then returns 503. */
  draftWriter?: DraftWriter;
  /** Omit when no Google API key is configured; Places endpoints then return 503. */
  places?: PlacesClient;
  /** Omit when no language model is configured; chat then returns 503. */
  chatModel?: ChatModel;
}

const PUBLIC_PATHS = new Set(['/v1/health', '/v1/openapi.json']);

export const openApiInfo = {
  openapi: '3.1.0',
  info: {
    title: 'Arclight API',
    version: '0.1.0',
    description:
      'HTTP API of the Arclight engine. Call it from your server with an API key; never expose the key to browsers.',
    license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' },
  },
};

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  operationId: 'getHealth',
  summary: 'Liveness check',
  tags: ['System'],
  responses: {
    200: {
      description: 'The API is running',
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
    },
  },
});

export function createApp({ db, auditQueue, draftWriter, places, chatModel }: AppDependencies) {
  const requireApiKey = createMiddleware<AppEnv>(async (c, next) => {
    if (PUBLIC_PATHS.has(c.req.path)) return next();

    const [scheme, token] = (c.req.header('Authorization') ?? '').split(' ');
    const apiKey = scheme === 'Bearer' && token ? await verifyApiKey(db, token) : null;
    if (!apiKey) {
      return c.json(
        { error: { code: 'unauthorized', message: 'Missing or invalid API key' } },
        401,
        { 'WWW-Authenticate': 'Bearer' },
      );
    }
    c.set('apiKey', apiKey);
    return next();
  });

  const v1 = createRouter();
  v1.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'API key created with `pnpm api-key:create <name>`',
  });
  v1.use('*', requireApiKey);
  v1.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }, 200))
    .route('/', businessRoutes(db, auditQueue, draftWriter, places))
    .route('/', agencyRoutes(db))
    .route('/', placesRoutes(db, places))
    .route('/', huntRoutes(db, auditQueue, places))
    .route('/', briefingRoutes(db))
    .route('/', chatRoutes({ db, auditQueue, places, draftWriter }, chatModel))
    .route('/', settingsRoutes(db))
    .doc31('/openapi.json', { ...openApiInfo, servers: [{ url: '/v1' }] });

  const app = createRouter();
  app.route('/v1', v1);
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500);
  });
  return { app, v1 };
}
