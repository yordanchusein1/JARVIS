import { createRoute, z } from '@hono/zod-openapi';
import {
  addDoNotContact,
  getAgencyProfile,
  InvalidDoNotContactError,
  listDoNotContact,
  removeDoNotContact,
  signalInsights,
  updateScoringWeights,
  type Database,
  type DoNotContactEntry,
} from '@arclight/core';
import { createRouter } from '../router.ts';
import { DoNotContactSchema, ErrorSchema, SignalInsightSchema } from '../schemas.ts';

const json = <T extends z.ZodType>(s: T) => ({ 'application/json': { schema: s } });
const security = [{ bearerAuth: [] }];
const unauthorized = {
  401: { description: 'Missing or invalid API key', content: json(ErrorSchema) },
};

const toDto = (e: DoNotContactEntry) => ({ ...e, createdAt: e.createdAt.toISOString() });

const listDnc = createRoute({
  method: 'get',
  path: '/do-not-contact',
  operationId: 'listDoNotContact',
  summary: 'Domains, emails and phone numbers that must never be contacted',
  tags: ['Do not contact'],
  security,
  responses: {
    200: {
      description: 'The list',
      content: json(z.object({ data: z.array(DoNotContactSchema) })),
    },
    ...unauthorized,
  },
});

const addDnc = createRoute({
  method: 'post',
  path: '/do-not-contact',
  operationId: 'addDoNotContact',
  summary: 'Add a domain, email or phone number to the do-not-contact list',
  tags: ['Do not contact'],
  security,
  request: {
    body: {
      required: true,
      content: json(
        z.object({
          kind: z.enum(['domain', 'email', 'phone']),
          value: z.string().min(1).max(320),
          reason: z.string().max(500).optional(),
        }),
      ),
    },
  },
  responses: {
    201: { description: 'The entry', content: json(DoNotContactSchema) },
    400: { description: 'Invalid value', content: json(ErrorSchema) },
    ...unauthorized,
  },
});

const removeDnc = createRoute({
  method: 'delete',
  path: '/do-not-contact/{id}',
  operationId: 'removeDoNotContact',
  summary: 'Remove an entry from the do-not-contact list',
  tags: ['Do not contact'],
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Removed' },
    404: { description: 'No such entry', content: json(ErrorSchema) },
    ...unauthorized,
  },
});

const insights = createRoute({
  method: 'get',
  path: '/scoring/signals',
  operationId: 'listSignalInsights',
  summary: 'Every signal seen so far, with its weight and how it relates to 👍/👎 feedback',
  tags: ['Scoring'],
  security,
  responses: {
    200: {
      description: 'Signals',
      content: json(z.object({ data: z.array(SignalInsightSchema) })),
    },
    ...unauthorized,
  },
});

const weights = createRoute({
  method: 'put',
  path: '/scoring/weights',
  operationId: 'updateScoringWeights',
  summary: 'Replace the points of signals and recalculate all scores',
  tags: ['Scoring'],
  security,
  request: {
    body: {
      required: true,
      content: json(
        z.object({ weights: z.record(z.string().max(64), z.number().int().min(0).max(100)) }),
      ),
    },
  },
  responses: {
    204: { description: 'Saved; scores were recalculated' },
    ...unauthorized,
  },
});

export function settingsRoutes(db: Database) {
  return createRouter()
    .openapi(listDnc, async (c) => c.json({ data: (await listDoNotContact(db)).map(toDto) }, 200))
    .openapi(addDnc, async (c) => {
      const { kind, value, reason } = c.req.valid('json');
      try {
        return c.json(toDto(await addDoNotContact(db, kind, value, reason)), 201);
      } catch (error) {
        if (error instanceof InvalidDoNotContactError) {
          return c.json({ error: { code: 'invalid_request', message: error.message } }, 400);
        }
        throw error;
      }
    })
    .openapi(removeDnc, async (c) => {
      if (!(await removeDoNotContact(db, c.req.valid('param').id))) {
        return c.json({ error: { code: 'not_found', message: 'Entry not found' } }, 404);
      }
      return c.body(null, 204);
    })
    .openapi(insights, async (c) => {
      const { scoringWeights } = await getAgencyProfile(db);
      return c.json({ data: await signalInsights(db, scoringWeights) }, 200);
    })
    .openapi(weights, async (c) => {
      await updateScoringWeights(db, c.req.valid('json').weights);
      return c.body(null, 204);
    });
}
