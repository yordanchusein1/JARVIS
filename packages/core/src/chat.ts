import Anthropic from '@anthropic-ai/sdk';
import { getAgencyProfile } from './agency.ts';
import { getBriefing } from './briefing.ts';
import { getBusiness, setLeadStatus, trackPlaces, trackWebsites } from './businesses.ts';
import type { Database } from './db/client.ts';
import {
  DraftingNotReadyError,
  generateDrafts,
  latestDrafts,
  type DraftWriter,
} from './drafting.ts';
import { createHunt, HuntNotFoundError, listHunts, runHunt } from './hunts.ts';
import { requestAudits, type AuditQueue } from './jobs.ts';
import { getLead, listLeads, type LeadSummary } from './leads.ts';
import type { PlacesClient } from './places.ts';

/**
 * Chat with Arclight: Claude answers questions and does work through Arclight's own functions,
 * streaming its answer. Like everything else in Arclight, it has no way to send a message to a
 * prospect (docs/DECISIONS.md, D4).
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; status: 'start' | 'done' | 'error' }
  | { type: 'done'; text: string };

export interface ChatDependencies {
  db: Database;
  auditQueue: AuditQueue;
  places?: PlacesClient;
  draftWriter?: DraftWriter;
}

type ToolInput = Record<string, unknown>;

interface ChatTool {
  definition: Anthropic.Beta.BetaTool;
  run(input: ToolInput): Promise<unknown>;
}

/** An error the model should see and can react to, e.g. a missing Google key. */
class ToolFailure extends Error {}

const summary = (l: LeadSummary) => ({
  id: l.business.id,
  name: l.business.displayName,
  website: l.business.websiteUrl,
  fromGoogleMaps: l.business.placeId !== null,
  status: l.business.status,
  priority: l.priority,
  need: l.latestAudit?.needScore ?? null,
  capacity: l.latestAudit?.capacityScore ?? null,
  audit: l.latestAudit?.status ?? 'not audited',
});

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false,
});

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new ToolFailure(`"${name}" is required.`);
  return value.trim();
};

const LEAD_STATUSES = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'] as const;

export function chatTools({ db, auditQueue, places, draftWriter }: ChatDependencies): ChatTool[] {
  const lead = async (id: string) => {
    const found = await getLead(db, id);
    if (!found) throw new ToolFailure('No lead with this id. Use list_leads to find one.');
    return found;
  };

  return [
    {
      definition: {
        name: 'get_briefing',
        description:
          'What happened in the last 24 hours and what needs attention: new leads, leads with drafts ready to send, follow-ups that are due and hunt results. Use it for questions like "what\'s new?" or "what should I do today?".',
        input_schema: object({}),
      },
      async run() {
        const b = await getBriefing(db);
        return {
          newLeads: b.newLeads,
          audited: b.audited,
          auditsFailed: b.auditsFailed,
          readyToSend: b.readyToSend.map(summary),
          readyToSendTotal: b.readyToSendTotal,
          followUps: b.followUps.map((f) => ({ ...summary(f.lead), contactedAt: f.contactedAt })),
          followUpsTotal: b.followUpsTotal,
          huntRuns: b.huntRuns.map((r) => ({
            query: r.query,
            status: r.status,
            found: r.found,
            tracked: r.tracked,
            error: r.error,
          })),
          pipeline: b.pipeline,
        };
      },
    },
    {
      definition: {
        name: 'list_leads',
        description:
          'Tracked businesses, highest priority first. Priority (0-100) combines need (how much they need the agency) and capacity (whether they can afford it).',
        input_schema: object({ limit: { type: 'integer', minimum: 1, maximum: 50 } }),
      },
      async run({ limit }) {
        const leads = await listLeads(db, { limit: typeof limit === 'number' ? limit : 20 });
        return { leads: leads.map(summary) };
      },
    },
    {
      definition: {
        name: 'get_lead',
        description:
          'One lead with the evidence behind its scores, its published contacts and its latest drafts.',
        input_schema: object({ id: { type: 'string', description: 'Lead id' } }, ['id']),
      },
      async run({ id }) {
        const found = await lead(str(id, 'id'));
        return {
          ...summary(found),
          doNotContact: found.doNotContact,
          evidence: found.signals.map((s) => ({
            axis: s.axis,
            points: s.points,
            text: s.evidence,
          })),
          contacts: found.contacts.map((c) => ({ kind: c.kind, value: c.value })),
          drafts: (await latestDrafts(db, found.business.id)).map((d) => ({
            channel: d.channel,
            subject: d.subject,
            body: d.body,
            warnings: d.warnings,
          })),
        };
      },
    },
    {
      definition: {
        name: 'search_places',
        description:
          'Live Google Maps search, e.g. "klinik gigi Surabaya", with ratings and review counts. Nothing is stored; use track_places to track the good ones.',
        input_schema: object({ query: { type: 'string' } }, ['query']),
      },
      async run({ query }) {
        if (!places) throw new ToolFailure('Google Maps search is off: GOOGLE_API_KEY is not set.');
        const results = await places.searchText(str(query, 'query'));
        return {
          places: results.map((p) => ({
            placeId: p.placeId,
            name: p.name,
            address: p.address,
            website: p.websiteUrl,
            rating: p.rating,
            reviews: p.ratingCount,
          })),
        };
      },
    },
    {
      definition: {
        name: 'track_places',
        description:
          'Start tracking businesses from search_places by place ID. They are audited in the background.',
        input_schema: object(
          { placeIds: { type: 'array', items: { type: 'string' }, maxItems: 20 } },
          ['placeIds'],
        ),
      },
      async run({ placeIds }) {
        if (!Array.isArray(placeIds)) throw new ToolFailure('"placeIds" must be a list.');
        const result = await trackPlaces(db, placeIds.map(String).slice(0, 20));
        await requestAudits(db, auditQueue, result.createdIds);
        return { created: result.createdIds.length };
      },
    },
    {
      definition: {
        name: 'track_websites',
        description:
          'Start tracking businesses by website address. They are audited in the background.',
        input_schema: object(
          { websites: { type: 'array', items: { type: 'string' }, maxItems: 100 } },
          ['websites'],
        ),
      },
      async run({ websites }) {
        if (!Array.isArray(websites)) throw new ToolFailure('"websites" must be a list.');
        const result = await trackWebsites(db, websites.map(String).slice(0, 100));
        await requestAudits(db, auditQueue, result.createdIds);
        return { created: result.createdIds.length, skipped: result.skipped };
      },
    },
    {
      definition: {
        name: 'write_drafts',
        description:
          "Write a WhatsApp message and an email for a lead, citing only its audit evidence, in the agency's voice. Nothing is sent: the person reviews and sends from the lead's page.",
        input_schema: object({ id: { type: 'string', description: 'Lead id' } }, ['id']),
      },
      async run({ id }) {
        if (!draftWriter) throw new ToolFailure('Drafting is off: ANTHROPIC_API_KEY is not set.');
        try {
          const drafts = await generateDrafts(db, str(id, 'id'), draftWriter);
          return {
            drafts: drafts.map((d) => ({ channel: d.channel, subject: d.subject, body: d.body })),
          };
        } catch (error) {
          if (error instanceof DraftingNotReadyError) throw new ToolFailure(error.message);
          throw error;
        }
      },
    },
    {
      definition: {
        name: 'update_lead_status',
        description:
          'Move a lead through the pipeline. Only mark a lead "contacted" after the person says they sent a message.',
        input_schema: object(
          { id: { type: 'string' }, status: { type: 'string', enum: [...LEAD_STATUSES] } },
          ['id', 'status'],
        ),
      },
      async run({ id, status }) {
        const leadId = str(id, 'id');
        if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
          throw new ToolFailure(`"status" must be one of ${LEAD_STATUSES.join(', ')}.`);
        }
        if (!(await getBusiness(db, leadId))) throw new ToolFailure('No lead with this id.');
        await setLeadStatus(db, leadId, status as (typeof LEAD_STATUSES)[number]);
        return { ok: true };
      },
    },
    {
      definition: {
        name: 'list_hunts',
        description:
          'Hunts: saved Google Maps searches Arclight runs every day on its own to find new leads.',
        input_schema: object({}),
      },
      async run() {
        return {
          hunts: (await listHunts(db)).map(({ hunt, lastRun, nextRunAt, leads }) => ({
            id: hunt.id,
            query: hunt.query,
            active: hunt.active,
            runHour: hunt.runHour,
            leads,
            nextRunAt,
            lastRun: lastRun && {
              status: lastRun.status,
              found: lastRun.found,
              tracked: lastRun.tracked,
              error: lastRun.error,
            },
          })),
        };
      },
    },
    {
      definition: {
        name: 'create_hunt',
        description:
          'Save a Google Maps search that Arclight runs every day at runHour (local time) to find and audit new leads.',
        input_schema: object(
          {
            query: { type: 'string' },
            runHour: { type: 'integer', minimum: 0, maximum: 23 },
            maxNewPerRun: { type: 'integer', minimum: 1, maximum: 50 },
            minReviews: { type: 'integer', minimum: 0 },
          },
          ['query'],
        ),
      },
      async run({ query, runHour, maxNewPerRun, minReviews }) {
        const int = (v: unknown, min: number, max: number) =>
          Number.isInteger(v) && (v as number) >= min && (v as number) <= max
            ? (v as number)
            : undefined;
        const hunt = await createHunt(db, {
          query: str(query, 'query'),
          runHour: int(runHour, 0, 23),
          maxNewPerRun: int(maxNewPerRun, 1, 50),
          minReviews: int(minReviews, 0, 100_000),
        });
        return { id: hunt.id, query: hunt.query, runHour: hunt.runHour };
      },
    },
    {
      definition: {
        name: 'run_hunt',
        description: 'Run a hunt now instead of waiting for its hour.',
        input_schema: object({ id: { type: 'string', description: 'Hunt id' } }, ['id']),
      },
      async run({ id }) {
        try {
          const run = await runHunt(db, { places, auditQueue }, str(id, 'id'), 'manual');
          return { status: run.status, found: run.found, tracked: run.tracked, error: run.error };
        } catch (error) {
          if (error instanceof HuntNotFoundError) throw new ToolFailure('No hunt with this id.');
          throw error;
        }
      },
    },
  ];
}

async function systemPrompt(db: Database): Promise<string> {
  const profile = await getAgencyProfile(db);
  const today = new Intl.DateTimeFormat('en-GB', {
    timeZone: profile.timezone,
    dateStyle: 'full',
  }).format(new Date());
  return `You are Arclight, the lead generation assistant of ${profile.agencyName || 'a digital agency'}${
    profile.senderName ? `, talking with ${profile.senderName}` : ''
  }. The agency offers: ${profile.services || '(not set yet)'}. Today is ${today} (${profile.timezone}).

You help the agency find businesses that need its services, understand the evidence, write outreach and keep the pipeline moving. Use the tools to look things up and to act; don't guess lead data.

Rules:
- You cannot send messages to prospects, and must not claim to. Drafts are reviewed and sent by the person from the lead's page in Arclight.
- Only mark a lead "contacted" when the person says they sent a message.
- Google Maps details are live data; don't suggest copying them elsewhere.
- Reply in the language the person writes in. Be concise. Write plain text: short paragraphs and "-" lists, no tables or headings. For several leads, list names with their priority.`;
}

/** One model turn, streamed. Replaceable so the loop can be tested without calling Claude. */
export type ChatModel = (
  params: {
    system: string;
    messages: Anthropic.Beta.BetaMessageParam[];
    tools: Anthropic.Beta.BetaTool[];
  },
  onText: (delta: string) => void,
) => Promise<Anthropic.Beta.BetaMessage>;

export function createClaudeChatModel({
  client = new Anthropic(),
  model = 'claude-opus-5',
}: { client?: Anthropic; model?: string } = {}): ChatModel {
  return async ({ system, messages, tools }, onText) => {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      // If the model declines, the API retries on a suitable fallback model within the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      tools,
      messages,
    });
    stream.on('text', onText);
    return stream.finalMessage();
  };
}

const MAX_STEPS = 12;

/** Runs one chat turn: the model may call tools several times before it answers. */
export async function runChat(
  deps: ChatDependencies & { model: ChatModel },
  history: ChatMessage[],
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const tools = chatTools(deps);
  const byName = new Map(tools.map((t) => [t.definition.name, t]));
  const system = await systemPrompt(deps.db);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  let answer = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const message = await deps.model(
      { system, messages, tools: tools.map((t) => t.definition) },
      (delta) => {
        answer += delta;
        onEvent({ type: 'text', delta });
      },
    );

    if (message.stop_reason === 'refusal') {
      const note = '\n\nI can’t help with that request.';
      answer += note;
      onEvent({ type: 'text', delta: note });
      break;
    }
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }
    const calls = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
    );
    // A tool call cut off at max_tokens may carry a truncated input; don't run it.
    if (calls.length === 0 || message.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      calls.map(async (call) => {
        onEvent({ type: 'tool', name: call.name, status: 'start' });
        const tool = byName.get(call.name);
        try {
          if (!tool) throw new ToolFailure(`Unknown tool ${call.name}.`);
          const output = await tool.run((call.input ?? {}) as ToolInput);
          onEvent({ type: 'tool', name: call.name, status: 'done' });
          return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(output) };
        } catch (error) {
          onEvent({ type: 'tool', name: call.name, status: 'error' });
          const text =
            error instanceof ToolFailure ? error.message : 'The tool failed unexpectedly.';
          if (!(error instanceof ToolFailure))
            console.error(`Chat tool ${call.name} failed:`, error);
          return { type: 'tool_result', tool_use_id: call.id, content: text, is_error: true };
        }
      }),
    );
    // All results of one step go back in a single message.
    messages.push({ role: 'user', content: results });
    if (answer && !answer.endsWith('\n')) {
      answer += '\n\n';
      onEvent({ type: 'text', delta: '\n\n' });
    }
  }

  onEvent({ type: 'done', text: answer.trim() });
}
