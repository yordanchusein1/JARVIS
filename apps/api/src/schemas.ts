import { z } from '@hono/zod-openapi';
import {
  isValidTimeZone,
  type AgencyProfile,
  type Audit,
  type Briefing,
  type Draft,
  type Business,
  type ContactChannel,
  type HuntRun,
  type HuntSummary,
  type LeadDetail,
  type LeadSummary,
  type Signal,
} from '@arclight/core';

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
    huntId: z.uuid().nullable().openapi({ description: 'The hunt that found this business' }),
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
    timezone: z
      .string()
      .max(64)
      .refine(isValidTimeZone, 'Not a known time zone')
      .openapi({ example: 'Asia/Jakarta', description: 'IANA time zone for hunts and briefings' }),
    followUpDays: z.number().int().min(1).max(60).openapi({
      description: 'Days without a reply after which a contacted lead is due for a follow-up',
    }),
    automationPaused: z.boolean().openapi({
      description:
        'Stops scheduled hunts, to save API and server costs. Manual searches, hunt runs and audits still work.',
    }),
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
  const { updatedAt: _updatedAt, scoringWeights: _weights, ...fields } = profile;
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
    huntId: business.huntId,
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
      'Live data from Google Places. Google does not allow storing it, so it is never saved by Arclight.',
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

export const HuntRunSchema = z
  .object({
    id: z.uuid(),
    huntId: z.uuid(),
    trigger: z.enum(['schedule', 'manual']),
    status: z.enum(['running', 'succeeded', 'failed']),
    error: z.string().nullable(),
    found: z.number().int().openapi({ description: 'Places Google returned' }),
    alreadyTracked: z.number().int().openapi({ description: 'Places that were already leads' }),
    excluded: z.number().int().openapi({
      description: "Places left out by the hunt's filters or the do-not-contact list",
    }),
    tracked: z.number().int().openapi({ description: 'New leads started' }),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .openapi('HuntRun');

export const HuntSettingsSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .openapi({ example: 'klinik gigi Surabaya', description: 'A Google Maps search' }),
    active: z.boolean().openapi({ description: 'Paused hunts do not run on their schedule' }),
    runHour: z.number().int().min(0).max(23).openapi({
      description: "Hour of the day, in the agency's time zone, at which the hunt runs",
    }),
    maxNewPerRun: z.number().int().min(1).max(50).openapi({
      description: 'At most this many new leads per run, most-reviewed first',
    }),
    minReviews: z.number().int().min(0).max(100_000).openapi({
      description: 'Skip places with fewer Google reviews. Checked live, never stored.',
    }),
    includeNoWebsite: z.boolean().openapi({ description: 'Also track places without a website' }),
    autoDraft: z.boolean().openapi({
      description:
        'Write drafts automatically for new leads that reach autoDraftMinPriority. Drafts are never sent.',
    }),
    autoDraftMinPriority: z.number().int().min(0).max(100),
  })
  .openapi('HuntSettings');

export const HuntSchema = HuntSettingsSchema.extend({
  id: z.uuid(),
  leads: z.number().int().openapi({ description: 'Businesses this hunt has found' }),
  lastRun: HuntRunSchema.nullable(),
  nextRunAt: z.iso
    .datetime()
    .nullable()
    .openapi({ description: 'When the next scheduled run is due; null while paused' }),
  createdAt: z.iso.datetime(),
}).openapi('Hunt');

export function toHuntRunDto(run: HuntRun): z.infer<typeof HuntRunSchema> {
  return {
    id: run.id,
    huntId: run.huntId,
    trigger: run.trigger,
    status: run.status,
    error: run.error,
    found: run.found,
    alreadyTracked: run.alreadyTracked,
    excluded: run.excluded,
    tracked: run.tracked,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export function toHuntDto({
  hunt,
  lastRun,
  nextRunAt,
  leads,
}: HuntSummary): z.infer<typeof HuntSchema> {
  return {
    id: hunt.id,
    query: hunt.query,
    active: hunt.active,
    runHour: hunt.runHour,
    maxNewPerRun: hunt.maxNewPerRun,
    minReviews: hunt.minReviews,
    includeNoWebsite: hunt.includeNoWebsite,
    autoDraft: hunt.autoDraft,
    autoDraftMinPriority: hunt.autoDraftMinPriority,
    leads,
    lastRun: lastRun ? toHuntRunDto(lastRun) : null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    createdAt: hunt.createdAt.toISOString(),
  };
}

const LeadStageCounts = z.object(
  Object.fromEntries(LEAD_STATUSES.map((s) => [s, z.number().int()])) as Record<
    (typeof LEAD_STATUSES)[number],
    z.ZodNumber
  >,
);

export const BriefingSchema = z
  .object({
    since: z.iso.datetime(),
    until: z.iso.datetime(),
    newLeads: z.number().int().openapi({ description: 'Businesses tracked in the period' }),
    audited: z.number().int(),
    auditsFailed: z.number().int(),
    draftsWritten: z.number().int().openapi({ description: 'Leads that got drafts in the period' }),
    topNewLeads: z
      .array(BusinessSchema)
      .openapi({ description: 'The best leads found in the period (at most 5)' }),
    readyToSend: z.array(BusinessSchema).openapi({
      description: 'New leads with drafts waiting to be reviewed and sent, best first (at most 5)',
    }),
    readyToSendTotal: z.number().int(),
    followUps: z
      .array(z.object({ business: BusinessSchema, contactedAt: z.iso.datetime() }))
      .openapi({
        description:
          'Contacted leads with no reply after the follow-up days, oldest first (at most 10)',
      }),
    followUpsTotal: z.number().int(),
    huntRuns: z.array(HuntRunSchema.extend({ query: z.string() })),
    pipeline: LeadStageCounts.openapi({ description: 'Leads per pipeline stage, all time' }),
  })
  .openapi('Briefing');

export function toBriefingDto(briefing: Briefing): z.infer<typeof BriefingSchema> {
  return {
    since: briefing.since.toISOString(),
    until: briefing.until.toISOString(),
    newLeads: briefing.newLeads,
    audited: briefing.audited,
    auditsFailed: briefing.auditsFailed,
    draftsWritten: briefing.draftsWritten,
    topNewLeads: briefing.topNewLeads.map(toBusinessDto),
    readyToSend: briefing.readyToSend.map(toBusinessDto),
    readyToSendTotal: briefing.readyToSendTotal,
    followUps: briefing.followUps.map((f) => ({
      business: toBusinessDto(f.lead),
      contactedAt: f.contactedAt.toISOString(),
    })),
    followUpsTotal: briefing.followUpsTotal,
    huntRuns: briefing.huntRuns.map((r) => ({ ...toHuntRunDto(r), query: r.query })),
    pipeline: briefing.pipeline,
  };
}
