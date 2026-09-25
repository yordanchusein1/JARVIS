import { createRoute, z } from '@hono/zod-openapi';
import { getBriefing, type Database } from '@arclight/core';
import { createRouter } from '../router.ts';
import { BriefingSchema, ErrorSchema, toBriefingDto } from '../schemas.ts';

const briefingRoute = createRoute({
  method: 'get',
  path: '/briefing',
  operationId: 'getBriefing',
  summary: 'What happened recently and what needs attention now',
  description:
    'Counts for the period since `since` (default: the last 24 hours), the best new leads, drafts waiting to be sent, follow-ups that are due and recent hunt runs.',
  tags: ['Briefing'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      since: z.iso.datetime({ offset: true }).optional().openapi({
        example: '2026-09-24T00:00:00Z',
      }),
    }),
  },
  responses: {
    200: {
      description: 'The briefing',
      content: { 'application/json': { schema: BriefingSchema } },
    },
    401: {
      description: 'Missing or invalid API key',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

export function briefingRoutes(db: Database) {
  return createRouter().openapi(briefingRoute, async (c) => {
    const { since } = c.req.valid('query');
    const briefing = await getBriefing(db, { since: since ? new Date(since) : undefined });
    return c.json(toBriefingDto(briefing), 200);
  });
}
