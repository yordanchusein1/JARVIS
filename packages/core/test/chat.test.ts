import type Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { updateAgencyProfile } from '../src/agency.ts';
import { trackWebsites } from '../src/businesses.ts';
import { runChat, type ChatEvent, type ChatModel } from '../src/chat.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;
beforeEach(() => database.reset());
afterAll(() => database.close());

type Block = Anthropic.Beta.BetaContentBlock;
const message = (stop: Anthropic.Beta.BetaMessage['stop_reason'], content: Block[]) =>
  ({ stop_reason: stop, content }) as Anthropic.Beta.BetaMessage;
const text = (t: string) => ({ type: 'text', text: t, citations: null }) as Block;
const toolUse = (id: string, name: string, input: object) =>
  ({ type: 'tool_use', id, name, input }) as Block;

/** A model that plays back scripted turns and records what it was sent. */
function scripted(turns: { say?: string; reply: Anthropic.Beta.BetaMessage }[]) {
  const calls: Parameters<ChatModel>[0][] = [];
  const model: ChatModel = async (params, onText) => {
    calls.push(structuredClone(params));
    const turn = turns[calls.length - 1]!;
    if (turn.say) onText(turn.say);
    return turn.reply;
  };
  return { model, calls };
}

const queue = { enqueue: async () => {} };

describe('runChat', () => {
  it('lets the model use Arclight tools, then streams its answer', async () => {
    await updateAgencyProfile(db, {
      agencyName: 'Vera & Co',
      senderName: 'Yordan',
      services: 'Web',
    });
    await trackWebsites(db, ['klinik.co.id']);
    const { model, calls } = scripted([
      {
        say: 'Let me check.',
        reply: message('tool_use', [
          text('Let me check.'),
          toolUse('t1', 'list_leads', { limit: 5 }),
          toolUse('t2', 'write_drafts', { id: 'x' }),
        ]),
      },
      { say: 'You have 1 lead.', reply: message('end_turn', [text('You have 1 lead.')]) },
    ]);
    const events: ChatEvent[] = [];
    await runChat({ db, auditQueue: queue, model }, [{ role: 'user', content: 'Ada lead?' }], (e) =>
      events.push(e),
    );

    expect(calls[0]!.system).toContain('Vera & Co');
    expect(calls[0]!.system).toContain('cannot send messages');
    expect(calls[0]!.tools.map((t) => t.name)).not.toContain('send_message');
    // Both results of the step come back in one user message, the failed one marked as an error.
    const results = calls[1]!.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results).toHaveLength(2);
    expect(JSON.parse(results[0]!.content as string).leads[0].website).toBe(
      'https://klinik.co.id/',
    );
    expect(results[1]).toMatchObject({
      is_error: true,
      content: expect.stringMatching(/ANTHROPIC_API_KEY/),
    });
    expect(events).toContainEqual({ type: 'tool', name: 'list_leads', status: 'done' });
    expect(events).toContainEqual({ type: 'tool', name: 'write_drafts', status: 'error' });
    expect(events.at(-1)).toEqual({ type: 'done', text: 'Let me check.\n\nYou have 1 lead.' });
  });

  it('stops on a refusal and never runs tools from a truncated turn', async () => {
    const { model } = scripted([
      {
        reply: message('max_tokens', [toolUse('t1', 'track_websites', { websites: ['a.co.id'] })]),
      },
    ]);
    const events: ChatEvent[] = [];
    await runChat({ db, auditQueue: queue, model }, [{ role: 'user', content: 'x' }], (e) =>
      events.push(e),
    );
    expect(events.some((e) => e.type === 'tool')).toBe(false);

    const refusing = scripted([{ reply: message('refusal', []) }]);
    const refused: ChatEvent[] = [];
    await runChat(
      { db, auditQueue: queue, model: refusing.model },
      [{ role: 'user', content: 'x' }],
      (e) => refused.push(e),
    );
    expect(refused.at(-1)).toMatchObject({
      type: 'done',
      text: expect.stringMatching(/can’t help/),
    });
  });
});
