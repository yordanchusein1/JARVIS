import { z } from '@hono/zod-openapi';
import type { Business } from '@jarvis/core';

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'not_found' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('Error');

export const BusinessSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(['url', 'csv', 'places']),
    placeId: z.string().nullable(),
    websiteUrl: z.string().nullable().openapi({ example: 'https://klinik.co.id/' }),
    displayName: z.string().nullable(),
    status: z.enum(['new', 'contacted', 'replied', 'meeting', 'won', 'lost']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Business');

export function toBusinessDto(business: Business): z.infer<typeof BusinessSchema> {
  return {
    id: business.id,
    source: business.source,
    placeId: business.placeId,
    websiteUrl: business.websiteUrl,
    displayName: business.displayName,
    status: business.status,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}
