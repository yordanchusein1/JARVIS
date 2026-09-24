import { z } from '@hono/zod-openapi';
import type {
  Audit,
  Business,
  ContactChannel,
  LeadDetail,
  LeadSummary,
  Signal,
} from '@jarvis/core';

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'not_found' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('Error');

const score = z.number().int().min(0).max(100).nullable();

export const AuditSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed']),
    needScore: score.openapi({ description: 'How much the business needs the agency (0–100)' }),
    capacityScore: score.openapi({ description: 'How established the business is (0–100)' }),
    error: z.string().nullable(),
    notes: z.array(z.string()).openapi({ description: 'How the audit ran, e.g. skipped checks' }),
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .openapi('Audit');

export const BusinessSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(['url', 'csv', 'places']),
    placeId: z.string().nullable(),
    websiteUrl: z.string().nullable().openapi({ example: 'https://klinik.co.id/' }),
    displayName: z.string().nullable(),
    status: z.enum(['new', 'contacted', 'replied', 'meeting', 'won', 'lost']),
    priority: score.openapi({
      description: 'Geometric mean of the latest need and capacity scores',
    }),
    latestAudit: AuditSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Business');

export const SignalSchema = z
  .object({
    axis: z.enum(['need', 'capacity']),
    key: z.string().openapi({ example: 'slow_mobile' }),
    points: z.number().int(),
    evidence: z.string().openapi({
      example: 'Google PageSpeed Insights rates the mobile performance 34/100.',
    }),
  })
  .openapi('Signal');

export const ContactSchema = z
  .object({
    kind: z.enum([
      'email',
      'phone',
      'whatsapp',
      'instagram',
      'facebook',
      'tiktok',
      'linkedin',
      'other',
    ]),
    value: z.string(),
    sourceUrl: z.string().nullable(),
  })
  .openapi('Contact');

export const BusinessDetailSchema = BusinessSchema.extend({
  signals: z
    .array(SignalSchema)
    .openapi({ description: 'Signals from the latest audit, strongest first' }),
  contacts: z.array(ContactSchema),
}).openapi('BusinessDetail');

export function toAuditDto(audit: Audit): z.infer<typeof AuditSchema> {
  return {
    id: audit.id,
    status: audit.status,
    needScore: audit.needScore,
    capacityScore: audit.capacityScore,
    error: audit.error,
    notes: audit.notes,
    createdAt: audit.createdAt.toISOString(),
    finishedAt: audit.finishedAt?.toISOString() ?? null,
  };
}

function toBusinessFields(business: Business) {
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

export function toBusinessDto(lead: LeadSummary): z.infer<typeof BusinessSchema> {
  return {
    ...toBusinessFields(lead.business),
    priority: lead.priority,
    latestAudit: lead.latestAudit ? toAuditDto(lead.latestAudit) : null,
  };
}

export function toBusinessDetailDto(lead: LeadDetail): z.infer<typeof BusinessDetailSchema> {
  return {
    ...toBusinessDto(lead),
    signals: lead.signals.map((s: Signal) => ({
      axis: s.axis,
      key: s.key,
      points: s.points,
      evidence: s.evidence,
    })),
    contacts: lead.contacts.map((c: ContactChannel) => ({
      kind: c.kind,
      value: c.value,
      sourceUrl: c.sourceUrl,
    })),
  };
}
