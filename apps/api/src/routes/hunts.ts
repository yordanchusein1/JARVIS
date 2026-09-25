import { createRoute, z } from '@hono/zod-openapi';
import {
  createHunt,
  deleteHunt,
  listHuntRuns,
  listHunts,
  runHunt,
  updateHunt,
  type AuditQueue,
  type Database,
  type PlacesClient,
} from '@arclight/core';
import { createRouter } from '../router.ts';
import {
  ErrorSchema,
  HuntRunSchema,
  HuntSchema,
  HuntSettingsSchema,
  toHuntDto,
  toHuntRunDto,
} from '../schemas.ts';

const security = [{ bearerAuth: [] }];
const tags = ['Hunts'];
const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });
const unauthorized = {
  401: { description: 'Missing or invalid API key', content: json(ErrorSchema) },
};
const notFound = { 404: { description: 'No hunt with this id', content: json(ErrorSchema) } };
const idParam = z.object({ id: z.uuid() });

const listRoute = createRoute({
  method: 'get',
  path: '/hunts',
  operationId: 'listHunts',
  summary: 'List hunts: saved Google Maps searches that find new leads every day',
  tags,
  security,
  responses: {
    200: {
      description: 'Hunts, newest first',
      content: json(z.object({ data: z.array(HuntSchema) })),
    },
    ...unauthorized,
  },
});

const createHuntRoute = createRoute({
  method: 'post',
  path: '/hunts',
  operationId: 'createHunt',
  summary: 'Create a hunt',
  description:
    "The hunt first runs the next time the clock reaches `runHour` in the agency's time zone. Only the settings you omit take their defaults.",
  tags,
  security,
  request: {
    body: {
      required: true,
      content: json(HuntSettingsSchema.partial().required({ query: true })),
    },
  },
  responses: {
    201: { description: 'The new hunt', content: json(HuntSchema) },
    ...unauthorized,
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/hunts/{id}',
  operationId: 'getHunt',
  summary: 'Get a hunt with its recent runs',
  tags,
  security,
  request: { params: idParam },
  responses: {
    200: {
      description: 'The hunt',
      content: json(
        HuntSchema.extend({
          runs: z.array(HuntRunSchema).openapi({ description: 'The last 10 runs, newest first' }),
        }),
      ),
    },
    ...notFound,
    ...unauthorized,
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/hunts/{id}',
  operationId: 'updateHunt',
  summary: 'Change, pause or resume a hunt',
  tags,
  security,
  request: {
    params: idParam,
    body: { required: true, content: json(HuntSettingsSchema.partial()) },
  },
  responses: {
    200: { description: 'The updated hunt', content: json(HuntSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/hunts/{id}',
  operationId: 'deleteHunt',
  summary: 'Delete a hunt and its run history. The leads it found stay.',
  tags,
  security,
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    ...notFound,
    ...unauthorized,
  },
});

const runRoute = createRoute({
  method: 'post',
  path: '/hunts/{id}/runs',
  operationId: 'runHunt',
  summary: 'Run a hunt now',
  description:
    'Searches Google Places, starts tracking the best new businesses and queues their audits. A run that fails (for example because Google refused the request) is returned with `status: "failed"` and an `error`.',
  tags,
  security,
  request: { params: idParam },
  responses: {
    201: { description: 'The finished run', content: json(HuntRunSchema) },
    ...notFound,
    ...unauthorized,
  },
});

const notFoundBody = { error: { code: 'not_found', message: 'Hunt not found' } };

export function huntRoutes(db: Database, auditQueue: AuditQueue, places: PlacesClient | undefined) {
  const summary = async (id: string) => (await listHunts(db, { ids: [id] }))[0];

  return createRouter()
    .openapi(listRoute, async (c) => c.json({ data: (await listHunts(db)).map(toHuntDto) }, 200))
    .openapi(createHuntRoute, async (c) => {
      const hunt = await createHunt(db, c.req.valid('json'));
      return c.json(toHuntDto((await summary(hunt.id))!), 201);
    })
    .openapi(getRoute, async (c) => {
      const found = await summary(c.req.valid('param').id);
      if (!found) return c.json(notFoundBody, 404);
      const runs = await listHuntRuns(db, found.hunt.id);
      return c.json({ ...toHuntDto(found), runs: runs.map(toHuntRunDto) }, 200);
    })
    .openapi(updateRoute, async (c) => {
      const hunt = await updateHunt(db, c.req.valid('param').id, c.req.valid('json'));
      if (!hunt) return c.json(notFoundBody, 404);
      return c.json(toHuntDto((await summary(hunt.id))!), 200);
    })
    .openapi(deleteRoute, async (c) => {
      if (!(await deleteHunt(db, c.req.valid('param').id))) return c.json(notFoundBody, 404);
      return c.body(null, 204);
    })
    .openapi(runRoute, async (c) => {
      const found = await summary(c.req.valid('param').id);
      if (!found) return c.json(notFoundBody, 404);
      const run = await runHunt(db, { places, auditQueue }, found.hunt.id, 'manual');
      return c.json(toHuntRunDto(run), 201);
    });
}
