import { createRoute, z } from '@hono/zod-openapi';
import {
  DraftingNotReadyError,
  generateDrafts,
  getBusiness,
  getLead,
  latestDrafts,
  listLeads,
  requestAudits,
  setLeadFeedback,
  setLeadStatus,
  trackPlaces,
  trackWebsites,
  websitesFromCsv,
  type AuditQueue,
  type Database,
  type DraftWriter,
  type PlacesClient,
} from '@arclight/core';
import { createRouter } from '../router.ts';
import {
  AuditSchema,
  BusinessDetailSchema,
  BusinessSchema,
  DraftSchema,
  ErrorSchema,
  LeadStatusSchema,
  PlaceSchema,
  toAuditDto,
  toBusinessDetailDto,
  toBusinessDto,
  toDraftDto,
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
          source: z
            .enum(['url', 'csv'])
            .default('url')
            .openapi({ description: 'Where the list came from' }),
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

const updateRoute = createRoute({
  method: 'patch',
  path: '/businesses/{id}',
  operationId: 'updateBusiness',
  summary: 'Update a lead, e.g. move it through the pipeline',
  tags,
  security,
  request: {
    params: idParam,
    body: {
      required: true,
      content: json(
        z
          .object({
            status: LeadStatusSchema.optional(),
            feedback: z.enum(['good', 'bad']).nullable().optional(),
          })
          .refine((b) => b.status !== undefined || b.feedback !== undefined, {
            message: 'Provide status or feedback',
          }),
      ),
    },
  },
  responses: {
    200: { description: 'The updated business', content: json(BusinessSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const draftRoute = createRoute({
  method: 'post',
  path: '/businesses/{id}/drafts',
  operationId: 'draftMessages',
  summary: 'Write WhatsApp and email drafts from the latest audit',
  description:
    'Drafts cite only facts from the audit. Arclight never sends them; a person reviews and sends each message.',
  tags,
  security,
  request: { params: idParam },
  responses: {
    201: { description: 'The new drafts', content: json(z.object({ data: z.array(DraftSchema) })) },
    409: {
      description: 'Not ready: the agency profile is incomplete or the audit has not succeeded',
      content: json(ErrorSchema),
    },
    502: { description: 'The language model failed', content: json(ErrorSchema) },
    503: { description: 'No language model is configured', content: json(ErrorSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const trackResponse = {
  200: {
    description: 'The tracked businesses',
    content: json(
      z.object({
        data: z.array(BusinessSchema),
        created: z.number().int(),
        skipped: z.array(z.object({ input: z.string(), reason: z.string() })),
      }),
    ),
  },
  ...unauthorized,
};

const trackPlacesRoute = createRoute({
  method: 'post',
  path: '/businesses/places',
  operationId: 'trackPlaces',
  summary: 'Start tracking businesses picked from a Google Places search',
  description: 'Only the Google place ID is stored. New businesses are queued for an audit.',
  tags,
  security,
  request: {
    body: {
      required: true,
      content: json(z.object({ placeIds: z.array(z.string().min(1).max(512)).min(1).max(20) })),
    },
  },
  responses: trackResponse,
});

const importCsvRoute = createRoute({
  method: 'post',
  path: '/businesses/import',
  operationId: 'importBusinessesCsv',
  summary: 'Start tracking the websites listed in a CSV export',
  description:
    'Uses the column headed website, url or domain, or else every cell that looks like a website. At most 1000 websites per import.',
  tags,
  security,
  request: {
    body: { required: true, content: json(z.object({ csv: z.string().min(1).max(1_000_000) })) },
  },
  responses: {
    ...trackResponse,
    400: { description: 'No websites found, or too many', content: json(ErrorSchema) },
  },
});

const placeRoute = createRoute({
  method: 'get',
  path: '/businesses/{id}/place',
  operationId: 'getBusinessPlace',
  summary: 'Live Google Places details of a business added from a Places search',
  tags,
  security,
  request: { params: idParam },
  responses: {
    200: { description: 'Live place details (not stored)', content: json(PlaceSchema) },
    503: { description: 'Google Places is not configured', content: json(ErrorSchema) },
    502: { description: 'Google Places failed', content: json(ErrorSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const notFoundBody = { error: { code: 'not_found', message: 'Business not found' } };

export function businessRoutes(
  db: Database,
  auditQueue: AuditQueue,
  draftWriter: DraftWriter | undefined,
  places: PlacesClient | undefined,
) {
  async function respondTracked(result: Awaited<ReturnType<typeof trackWebsites>>) {
    await requestAudits(db, auditQueue, result.createdIds);
    const leads = await listLeads(db, {
      ids: result.businesses.map((b) => b.id),
      limit: result.businesses.length || 1,
    });
    return {
      data: leads.map(toBusinessDto),
      created: result.createdIds.length,
      skipped: result.skipped,
    };
  }

  return createRouter()
    .openapi(listRoute, async (c) => {
      const leads = await listLeads(db, c.req.valid('query'));
      return c.json({ data: leads.map(toBusinessDto) }, 200);
    })
    .openapi(trackRoute, async (c) => {
      const { websites, source } = c.req.valid('json');
      return c.json(await respondTracked(await trackWebsites(db, websites, source)), 200);
    })
    .openapi(importCsvRoute, async (c) => {
      const websites = websitesFromCsv(c.req.valid('json').csv);
      if (websites.length === 0 || websites.length > 1000) {
        return c.json(
          {
            error: {
              code: 'invalid_request',
              message:
                websites.length === 0
                  ? 'No website addresses found in the CSV.'
                  : 'Import at most 1000 websites at a time.',
            },
          },
          400,
        );
      }
      return c.json(await respondTracked(await trackWebsites(db, websites, 'csv')), 200);
    })
    .openapi(trackPlacesRoute, async (c) => {
      const { placeIds } = c.req.valid('json');
      return c.json(await respondTracked(await trackPlaces(db, placeIds)), 200);
    })
    .openapi(placeRoute, async (c) => {
      const business = await getBusiness(db, c.req.valid('param').id);
      if (!business?.placeId) return c.json(notFoundBody, 404);
      if (!places) {
        return c.json(
          {
            error: { code: 'not_configured', message: 'Set GOOGLE_API_KEY to use Google Places.' },
          },
          503,
        );
      }
      try {
        const place = await places.getPlace(business.placeId);
        if (!place) return c.json(notFoundBody, 404);
        return c.json(place, 200);
      } catch (error) {
        console.error('Google Places failed:', error);
        return c.json({ error: { code: 'places_error', message: 'Google Places failed.' } }, 502);
      }
    })
    .openapi(getRoute, async (c) => {
      const lead = await getLead(db, c.req.valid('param').id);
      if (!lead) return c.json(notFoundBody, 404);
      return c.json(toBusinessDetailDto(lead, await latestDrafts(db, lead.business.id)), 200);
    })
    .openapi(auditRoute, async (c) => {
      const business = await getBusiness(db, c.req.valid('param').id);
      if (!business) return c.json(notFoundBody, 404);
      const [audit] = await requestAudits(db, auditQueue, [business.id]);
      return c.json(toAuditDto(audit!), 202);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid('param');
      const { status, feedback } = c.req.valid('json');
      if (!(await getBusiness(db, id))) return c.json(notFoundBody, 404);
      if (status !== undefined) await setLeadStatus(db, id, status);
      if (feedback !== undefined) await setLeadFeedback(db, id, feedback);
      const [lead] = await listLeads(db, { ids: [id] });
      return c.json(toBusinessDto(lead!), 200);
    })
    .openapi(draftRoute, async (c) => {
      const { id } = c.req.valid('param');
      if (!(await getBusiness(db, id))) return c.json(notFoundBody, 404);
      if (!draftWriter) {
        return c.json(
          {
            error: {
              code: 'not_configured',
              message: 'Set ANTHROPIC_API_KEY on the API server to write drafts.',
            },
          },
          503,
        );
      }
      try {
        const drafts = await generateDrafts(db, id, draftWriter);
        return c.json({ data: drafts.map(toDraftDto) }, 201);
      } catch (error) {
        if (error instanceof DraftingNotReadyError) {
          return c.json({ error: { code: 'not_ready', message: error.message } }, 409);
        }
        console.error('Drafting failed:', error);
        return c.json(
          { error: { code: 'model_error', message: 'The language model could not write drafts.' } },
          502,
        );
      }
    });
}
