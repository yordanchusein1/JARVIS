import { sendLinks as draftLinks, type ArclightClient, type components } from '@arclighthq/sdk';

type Business = components['schemas']['Business'];
type BusinessDetail = components['schemas']['BusinessDetail'];

/** A tool failure the agent should see and can act on, e.g. a validation or "not ready" error. */
export class ToolError extends Error {
  override name = 'ToolError';
}

type JsonSchema = Record<string, unknown>;

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  run(arclight: ArclightClient, args: Record<string, unknown>): Promise<unknown>;
}

/** Turns an API result into its data, or a ToolError with the API's message. */
async function unwrap<T>(
  call: Promise<{
    data?: T;
    error?: { error: { code: string; message: string; details?: unknown } };
    response: Response;
  }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (error) {
    const details = error.error.details ? ` Details: ${JSON.stringify(error.error.details)}` : '';
    throw new ToolError(`${error.error.message} (${error.error.code}).${details}`);
  }
  if (data === undefined && response.status !== 204) {
    throw new ToolError(`The Arclight API answered with HTTP ${response.status}.`);
  }
  return data as T;
}

const id = { type: 'string', format: 'uuid', description: 'Lead (business) id' };
const huntId = { type: 'string', format: 'uuid', description: 'Hunt id' };
const object = (properties: Record<string, JsonSchema>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const huntSettings = {
  query: {
    type: 'string',
    minLength: 2,
    maxLength: 200,
    description: 'A Google Maps search, e.g. "klinik gigi Surabaya"',
  },
  runHour: {
    type: 'integer',
    minimum: 0,
    maximum: 23,
    description: "Hour of the day, in the agency's time zone, at which it runs (default 7)",
  },
  maxNewPerRun: {
    type: 'integer',
    minimum: 1,
    maximum: 50,
    description: 'At most this many new leads per run, most-reviewed first (default 10)',
  },
  minReviews: {
    type: 'integer',
    minimum: 0,
    description: 'Skip places with fewer Google reviews (default 0)',
  },
  includeNoWebsite: {
    type: 'boolean',
    description: 'Also track places without a website (default true)',
  },
  autoDraft: {
    type: 'boolean',
    description: 'Write drafts automatically for strong new leads (default false). Never sends.',
  },
  autoDraftMinPriority: { type: 'integer', minimum: 0, maximum: 100 },
  active: { type: 'boolean', description: 'false pauses the daily runs' },
};

/** A compact view of a lead for lists, so agents don't wade through every field. */
function summary(b: Business) {
  return {
    id: b.id,
    name: b.displayName,
    website: b.websiteUrl,
    fromGoogleMaps: b.placeId !== null,
    status: b.status,
    priority: b.priority,
    need: b.latestAudit?.needScore ?? null,
    capacity: b.latestAudit?.capacityScore ?? null,
    audit: b.latestAudit?.status ?? 'not audited',
  };
}

/**
 * Links that open WhatsApp or an email program with a draft filled in, for the person to send.
 * The phone number listed on Google Maps is used when the business publishes none.
 */
async function sendLinks(arclight: ArclightClient, lead: BusinessDetail) {
  if (lead.doNotContact) return [];
  let contacts = lead.contacts;
  if (lead.placeId && !contacts.some((c) => c.kind === 'phone' || c.kind === 'whatsapp')) {
    const { data: place } = await arclight.GET('/businesses/{id}/place', {
      params: { path: { id: lead.id } },
    });
    if (place?.phone)
      contacts = [...contacts, { kind: 'phone', value: place.phone, sourceUrl: null }];
  }
  return lead.drafts.flatMap((draft) =>
    draftLinks(draft, contacts).map(({ channel, to, href }) => ({ channel, to, url: href })),
  );
}

export const tools: Tool[] = [
  {
    name: 'get_briefing',
    title: 'Daily briefing',
    description:
      'What happened recently and what needs a person now: new leads, audits, leads with drafts ready to send, follow-ups that are due and hunt results. Start here when asked "what\'s new" or "what should I do today".',
    inputSchema: object({
      since: {
        type: 'string',
        format: 'date-time',
        description: 'Start of the period (ISO 8601). Default: the last 24 hours.',
      },
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(arclight, { since }) {
      const briefing = await unwrap(
        arclight.GET('/briefing', { params: { query: { since: since as string | undefined } } }),
      );
      return {
        ...briefing,
        topNewLeads: briefing.topNewLeads.map(summary),
        readyToSend: briefing.readyToSend.map(summary),
        followUps: briefing.followUps.map((f) => ({
          ...summary(f.business),
          contactedAt: f.contactedAt,
        })),
      };
    },
  },
  {
    name: 'list_leads',
    title: 'List leads',
    description:
      'Tracked businesses, highest priority first. Priority is the geometric mean of need (how much they need an agency) and capacity (whether they can afford one), each 0–100.',
    inputSchema: object({
      limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 20' },
      offset: { type: 'integer', minimum: 0 },
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(arclight, { limit = 20, offset = 0 }) {
      const { data } = await unwrap(
        arclight.GET('/businesses', {
          params: { query: { limit: limit as number, offset: offset as number } },
        }),
      );
      return { leads: data.map(summary) };
    },
  },
  {
    name: 'get_lead',
    title: 'Get a lead',
    description:
      'One lead with the evidence behind its scores, its published contacts, the latest drafts and links that open WhatsApp or email with a draft filled in. Give those links to the person; they send the message themselves.',
    inputSchema: object({ id }, ['id']),
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(arclight, args) {
      const lead = await unwrap(
        arclight.GET('/businesses/{id}', { params: { path: { id: args.id as string } } }),
      );
      return { ...lead, sendLinks: await sendLinks(arclight, lead) };
    },
  },
  {
    name: 'search_places',
    title: 'Search Google Maps',
    description:
      'Live Google Maps search for prospects, e.g. "dental clinic Surabaya". Shows ratings and review counts to judge how established a business is. Results are not stored; use track_places to start tracking the ones worth it.',
    inputSchema: object(
      {
        query: {
          type: 'string',
          minLength: 2,
          maxLength: 200,
          description: 'Business type and place',
        },
      },
      ['query'],
    ),
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(arclight, { query }) {
      const { data } = await unwrap(
        arclight.GET('/places/search', { params: { query: { q: query as string } } }),
      );
      return { places: data };
    },
  },
  {
    name: 'track_places',
    title: 'Track Google Maps places',
    description:
      'Start tracking businesses from search_places by their place IDs. Each new one is audited in the background; check it later with get_lead.',
    inputSchema: object(
      {
        placeIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 20,
        },
      },
      ['placeIds'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(arclight, { placeIds }) {
      const result = await unwrap(
        arclight.POST('/businesses/places', { body: { placeIds: placeIds as string[] } }),
      );
      return { created: result.created, skipped: result.skipped, leads: result.data.map(summary) };
    },
  },
  {
    name: 'track_websites',
    title: 'Track websites',
    description:
      'Start tracking businesses by their website addresses, e.g. "klinik.co.id". Each new one is audited in the background. Websites on the do-not-contact list are skipped.',
    inputSchema: object(
      {
        websites: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 100,
        },
      },
      ['websites'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(arclight, { websites }) {
      const result = await unwrap(
        arclight.POST('/businesses', { body: { websites: websites as string[] } }),
      );
      return { created: result.created, skipped: result.skipped, leads: result.data.map(summary) };
    },
  },
  {
    name: 'audit_lead',
    title: 'Re-audit a lead',
    description: "Queue a fresh audit of a lead's website, e.g. after the business changed it.",
    inputSchema: object({ id }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async run(arclight, args) {
      return unwrap(
        arclight.POST('/businesses/{id}/audits', { params: { path: { id: args.id as string } } }),
      );
    },
  },
  {
    name: 'write_drafts',
    title: 'Write outreach drafts',
    description:
      "Write a WhatsApp message and an email for a lead, citing only what its audit measured, in the agency's name and voice. Nothing is sent: show the drafts and the send links from get_lead to the person.",
    inputSchema: object({ id }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async run(arclight, args) {
      const { data } = await unwrap(
        arclight.POST('/businesses/{id}/drafts', { params: { path: { id: args.id as string } } }),
      );
      return { drafts: data };
    },
  },
  {
    name: 'update_lead',
    title: 'Update a lead',
    description:
      'Move a lead through the pipeline (new → contacted → replied → meeting → won or lost), or rate it good or bad to calibrate scoring. Only mark a lead contacted after the person has sent a message.',
    inputSchema: object(
      {
        id,
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'],
        },
        feedback: { type: ['string', 'null'], enum: ['good', 'bad', null] },
      },
      ['id'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(arclight, { id: leadId, status, feedback }) {
      if (status === undefined && feedback === undefined) {
        throw new ToolError('Provide status or feedback.');
      }
      const lead = await unwrap(
        arclight.PATCH('/businesses/{id}', {
          params: { path: { id: leadId as string } },
          body: {
            status: status as Business['status'] | undefined,
            feedback: feedback as Business['feedback'] | undefined,
          },
        }),
      );
      return summary(lead);
    },
  },
  {
    name: 'add_do_not_contact',
    title: 'Add to the do-not-contact list',
    description:
      'Use when a business asks not to be contacted. Arclight then never tracks, shows or drafts for that domain, email address or phone number again.',
    inputSchema: object(
      {
        kind: { type: 'string', enum: ['domain', 'email', 'phone'] },
        value: { type: 'string', description: 'e.g. "klinik.co.id", "info@klinik.co.id"' },
        reason: { type: 'string' },
      },
      ['kind', 'value'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(arclight, { kind, value, reason }) {
      return unwrap(
        arclight.POST('/do-not-contact', {
          body: {
            kind: kind as 'domain' | 'email' | 'phone',
            value: value as string,
            reason: reason as string | undefined,
          },
        }),
      );
    },
  },
  {
    name: 'list_hunts',
    title: 'List hunts',
    description:
      'Hunts are saved Google Maps searches that Arclight runs every day on its own to find new leads. Shows each with its settings, last run and next run.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(arclight) {
      return { hunts: (await unwrap(arclight.GET('/hunts'))).data };
    },
  },
  {
    name: 'create_hunt',
    title: 'Create a hunt',
    description:
      'Save a Google Maps search that Arclight runs every day to find, audit and (optionally) draft for new leads. It never sends messages.',
    inputSchema: object(huntSettings, ['query']),
    annotations: { readOnlyHint: false, destructiveHint: false },
    async run(arclight, args) {
      return unwrap(arclight.POST('/hunts', { body: args as { query: string } }));
    },
  },
  {
    name: 'update_hunt',
    title: 'Change, pause or resume a hunt',
    description: "Change a hunt's settings. Set active to false to pause it, true to resume.",
    inputSchema: object({ id: huntId, ...huntSettings }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(arclight, { id: hunt, ...settings }) {
      return unwrap(
        arclight.PATCH('/hunts/{id}', { params: { path: { id: hunt as string } }, body: settings }),
      );
    },
  },
  {
    name: 'run_hunt',
    title: 'Run a hunt now',
    description:
      'Run a hunt immediately instead of waiting for its hour. Returns how many places were found and how many new leads were started.',
    inputSchema: object({ id: huntId }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async run(arclight, args) {
      return unwrap(
        arclight.POST('/hunts/{id}/runs', { params: { path: { id: args.id as string } } }),
      );
    },
  },
];
