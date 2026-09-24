import { createRoute, z } from '@hono/zod-openapi';
import { getBusiness, listBusinesses, trackWebsites, type Database } from '@jarvis/core';
import { createRouter } from '../router.ts';
import { BusinessSchema, ErrorSchema, toBusinessDto } from '../schemas.ts';

const security = [{ bearerAuth: [] }];
const tags = ['Businesses'];

const unauthorized = {
  401: {
    description: 'Missing or invalid API key',
    content: { 'application/json': { schema: ErrorSchema } },
  },
};

const listRoute = createRoute({
  method: 'get',
  path: '/businesses',
  operationId: 'listBusinesses',
  summary: 'List tracked businesses, newest first',
  tags,
  security,
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: 'Tracked businesses',
      content: { 'application/json': { schema: z.object({ data: z.array(BusinessSchema) }) } },
    },
    ...unauthorized,
  },
});

const trackRoute = createRoute({
  method: 'post',
  path: '/businesses',
  operationId: 'trackBusinesses',
  summary: 'Start tracking businesses from website addresses',
  description:
    'Invalid addresses are reported in `skipped`. Websites that are already tracked are returned without being duplicated.',
  tags,
  security,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            websites: z
              .array(z.string().max(2048))
              .min(1)
              .max(100)
              .openapi({ example: ['klinik.co.id', 'https://www.sekolah-contoh.sch.id'] }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Businesses for the given websites',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(BusinessSchema),
            created: z.number().int(),
            skipped: z.array(z.object({ input: z.string(), reason: z.string() })),
          }),
        },
      },
    },
    ...unauthorized,
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/businesses/{id}',
  operationId: 'getBusiness',
  summary: 'Get one tracked business',
  tags,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'The business',
      content: { 'application/json': { schema: BusinessSchema } },
    },
    404: {
      description: 'No business with this id',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    ...unauthorized,
  },
});

export function businessRoutes(db: Database) {
  return createRouter()
    .openapi(listRoute, async (c) => {
      const rows = await listBusinesses(db, c.req.valid('query'));
      return c.json({ data: rows.map(toBusinessDto) }, 200);
    })
    .openapi(trackRoute, async (c) => {
      const { websites } = c.req.valid('json');
      const result = await trackWebsites(db, websites);
      return c.json(
        {
          data: result.businesses.map(toBusinessDto),
          created: result.created,
          skipped: result.skipped,
        },
        200,
      );
    })
    .openapi(getRoute, async (c) => {
      const business = await getBusiness(db, c.req.valid('param').id);
      if (!business) {
        return c.json({ error: { code: 'not_found', message: 'Business not found' } }, 404);
      }
      return c.json(toBusinessDto(business), 200);
    });
}
