import { z } from '@hono/zod-openapi';
import type {
  AgencyProfile,
  Audit,
  Draft,
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

const LEAD_STATUSES = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'] as const;
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
    status: z.enum(LEAD_STATUSES),
    feedback: z
      .enum(['good', 'bad'])
      .nullable()
      .openapi({ description: 'A person rated this lead 👍 or 👎' }),
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

export const DraftSchema = z
  .object({
    id: z.uuid(),
    channel: z.enum(['whatsapp', 'email']),
    subject: z.string().nullable(),
    body: z.string(),
    warnings: z.array(z.string()).openapi({
      description: 'Automatic checks to review before sending, e.g. an unsupported number',
    }),
    model: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('Draft');

export const LeadStatusSchema = z.enum(LEAD_STATUSES).openapi('LeadStatus');

export const AgencyProfileSchema = z
  .object({
    agencyName: z.string().max(200),
    senderName: z.string().max(200),
    services: z
      .string()
      .max(2000)
      .openapi({ description: 'What the agency offers, in plain words' }),
    tone: z.string().max(200).openapi({ example: 'friendly and professional' }),
    language: z.string().min(2).max(35).openapi({ example: 'id', description: 'BCP 47 tag' }),
  })
  .openapi('AgencyProfile');

export function toDraftDto(draft: Draft): z.infer<typeof DraftSchema> {
  return {
    id: draft.id,
    channel: draft.channel,
    subject: draft.subject,
    body: draft.body,
    warnings: draft.warnings,
    model: draft.model,
    createdAt: draft.createdAt.toISOString(),
  };
}

export function toAgencyProfileDto(profile: AgencyProfile): z.infer<typeof AgencyProfileSchema> {
  const { updatedAt: _updatedAt, ...fields } = profile;
  return fields;
}

export const BusinessDetailSchema = BusinessSchema.extend({
  signals: z
    .array(SignalSchema)
    .openapi({ description: 'Signals from the latest audit, strongest first' }),
  contacts: z.array(ContactSchema),
  drafts: z.array(DraftSchema).openapi({ description: 'Latest draft per channel' }),
  doNotContact: z
    .boolean()
    .openapi({ description: "The website's domain is on the do-not-contact list" }),
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
    feedback: business.feedback,
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

export function toBusinessDetailDto(
  lead: LeadDetail,
  drafts: Draft[],
): z.infer<typeof BusinessDetailSchema> {
  return {
    drafts: drafts.map(toDraftDto),
    doNotContact: lead.doNotContact,
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

export const PlaceSchema = z
  .object({
    placeId: z.string(),
    name: z.string().nullable(),
    address: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    phone: z.string().nullable(),
    rating: z.number().nullable(),
    ratingCount: z.number().int().nullable(),
    mapsUrl: z.string().nullable(),
  })
  .openapi('Place', {
    description:
      'Live data from Google Places. Google does not allow storing it, so it is never saved by JARVIS.',
  });

export const DoNotContactSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(['domain', 'email', 'phone']),
    value: z.string(),
    reason: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi('DoNotContact');

export const SignalInsightSchema = z
  .object({
    key: z.string(),
    axis: z.enum(['need', 'capacity']),
    defaultPoints: z.number().int(),
    points: z.number().int(),
    leads: z.number().int(),
    good: z.number().int(),
    bad: z.number().int(),
  })
  .openapi('SignalInsight');
