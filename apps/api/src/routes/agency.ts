import { createRoute, z } from '@hono/zod-openapi';
import { getAgencyProfile, updateAgencyProfile, type Database } from '@jarvis/core';
import { createRouter } from '../router.ts';
import { AgencyProfileSchema, ErrorSchema, toAgencyProfileDto } from '../schemas.ts';

const security = [{ bearerAuth: [] }];
const tags = ['Agency'];
const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });
const unauthorized = {
  401: { description: 'Missing or invalid API key', content: json(ErrorSchema) },
};

const getRoute = createRoute({
  method: 'get',
  path: '/agency-profile',
  operationId: 'getAgencyProfile',
  summary: "Get the agency's profile, used to write outreach in its name",
  tags,
  security,
  responses: {
    200: { description: 'The profile', content: json(AgencyProfileSchema) },
    ...unauthorized,
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/agency-profile',
  operationId: 'updateAgencyProfile',
  summary: "Update the agency's profile",
  tags,
  security,
  request: { body: { required: true, content: json(AgencyProfileSchema.partial()) } },
  responses: {
    200: { description: 'The updated profile', content: json(AgencyProfileSchema) },
    ...unauthorized,
  },
});

export function agencyRoutes(db: Database) {
  return createRouter()
    .openapi(getRoute, async (c) => c.json(toAgencyProfileDto(await getAgencyProfile(db)), 200))
    .openapi(updateRoute, async (c) =>
      c.json(toAgencyProfileDto(await updateAgencyProfile(db, c.req.valid('json'))), 200),
    );
}
