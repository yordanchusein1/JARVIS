import { createRoute, z } from '@hono/zod-openapi';
import {
  getBusiness,
  getLead,
  listLeads,
  requestAudits,
  trackWebsites,
  type AuditQueue,
  type Database,
} from '@jarvis/core';
import { createRouter } from '../router.ts';
import {
  AuditSchema,
  BusinessDetailSchema,
  BusinessSchema,
  ErrorSchema,
  toAuditDto,
  toBusinessDetailDto,
  toBusinessDto,
} from '../schemas.ts';

const security = [{ bearerAuth: [] }];
const tags = ['Businesses'];
const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });

const unauthorized = {
  401: { description: 'Missing or invalid API key', content: json(ErrorSchema) },
};
const notFound = {
  404: { description: 'No business with this id', content: json(ErrorSchema) },
};
const idParam = z.object({ id: z.uuid() });

const listRoute = createRoute({
  method: 'get',
  path: '/businesses',
  operationId: 'listBusinesses',
  summary: 'List tracked businesses, highest priority first',
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
      description: 'Tracked businesses with their latest audit',
      content: json(z.object({ data: z.array(BusinessSchema) })),
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
    'New businesses are queued for an audit. Invalid addresses are reported in `skipped`, and websites that are already tracked are returned without being duplicated.',
  tags,
  security,
  request: {
    body: {
      required: true,
      content: json(
        z.object({
          websites: z
            .array(z.string().max(2048))
            .min(1)
            .max(100)
            .openapi({ example: ['klinik.co.id', 'https://www.sekolah-contoh.sch.id'] }),
        }),
      ),
    },
  },
  responses: {
    200: {
      description: 'Businesses for the given websites',
      content: json(
        z.object({
          data: z.array(BusinessSchema),
          created: z.number().int(),
          skipped: z.array(z.object({ input: z.string(), reason: z.string() })),
        }),
      ),
    },
    ...unauthorized,
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/businesses/{id}',
  operationId: 'getBusiness',
  summary: 'Get one business with the evidence and contacts from its latest audit',
  tags,
  security,
  request: { params: idParam },
  responses: {
    200: { description: 'The business', content: json(BusinessDetailSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const auditRoute = createRoute({
  method: 'post',
  path: '/businesses/{id}/audits',
  operationId: 'auditBusiness',
  summary: 'Queue a new audit of the business',
  tags,
  security,
  request: { params: idParam },
  responses: {
    202: { description: 'The audit was queued', content: json(AuditSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const notFoundBody = { error: { code: 'not_found', message: 'Business not found' } };

export function businessRoutes(db: Database, auditQueue: AuditQueue) {
  return createRouter()
    .openapi(listRoute, async (c) => {
      const leads = await listLeads(db, c.req.valid('query'));
      return c.json({ data: leads.map(toBusinessDto) }, 200);
    })
    .openapi(trackRoute, async (c) => {
      const { websites } = c.req.valid('json');
      const result = await trackWebsites(db, websites);
      await requestAudits(db, auditQueue, result.createdIds);
      const leads = await listLeads(db, { ids: result.businesses.map((b) => b.id), limit: 100 });
      return c.json(
        {
          data: leads.map(toBusinessDto),
          created: result.createdIds.length,
          skipped: result.skipped,
        },
        200,
      );
    })
    .openapi(getRoute, async (c) => {
      const lead = await getLead(db, c.req.valid('param').id);
      if (!lead) return c.json(notFoundBody, 404);
      return c.json(toBusinessDetailDto(lead), 200);
    })
    .openapi(auditRoute, async (c) => {
      const business = await getBusiness(db, c.req.valid('param').id);
      if (!business) return c.json(notFoundBody, 404);
      const [audit] = await requestAudits(db, auditQueue, [business.id]);
      return c.json(toAuditDto(audit!), 202);
    });
}
