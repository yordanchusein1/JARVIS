import { createRoute, z } from '@hono/zod-openapi';
import { schema, type Database, type PlacesClient } from '@arclight/core';
import { inArray } from 'drizzle-orm';
import { createRouter } from '../router.ts';
import { ErrorSchema, PlaceSchema } from '../schemas.ts';

const json = <T extends z.ZodType>(s: T) => ({ 'application/json': { schema: s } });

const searchRoute = createRoute({
  method: 'get',
  path: '/places/search',
  operationId: 'searchPlaces',
  summary: 'Search Google Places for prospects, e.g. "klinik gigi Surabaya"',
  description:
    'Results come live from Google and are not stored. `businessId` is set when a result is already tracked.',
  tags: ['Places'],
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ q: z.string().min(2).max(200) }) },
  responses: {
    200: {
      description: 'Matching places',
      content: json(
        z.object({ data: z.array(PlaceSchema.extend({ businessId: z.uuid().nullable() })) }),
      ),
    },
    401: { description: 'Missing or invalid API key', content: json(ErrorSchema) },
    502: { description: 'Google Places failed', content: json(ErrorSchema) },
    503: { description: 'Google Places is not configured', content: json(ErrorSchema) },
  },
});

export function placesRoutes(db: Database, places: PlacesClient | undefined) {
  return createRouter().openapi(searchRoute, async (c) => {
    if (!places) {
      return c.json(
        {
          error: { code: 'not_configured', message: 'Set GOOGLE_API_KEY to search Google Places.' },
        },
        503,
      );
    }
    let results;
    try {
      results = await places.searchText(c.req.valid('query').q);
    } catch (error) {
      console.error('Google Places failed:', error);
      return c.json(
        { error: { code: 'places_error', message: 'Google Places search failed.' } },
        502,
      );
    }
    const ids = results.map((p) => p.placeId);
    const tracked = ids.length
      ? await db
          .select({ id: schema.businesses.id, placeId: schema.businesses.placeId })
          .from(schema.businesses)
          .where(inArray(schema.businesses.placeId, ids))
      : [];
    const byPlace = new Map(tracked.map((t) => [t.placeId, t.id]));
    return c.json(
      { data: results.map((p) => ({ ...p, businessId: byPlace.get(p.placeId) ?? null })) },
      200,
    );
  });
}
