'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useArclight } from './context.tsx';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_briefing: 'Reading the briefing',
  list_leads: 'Looking at leads',
  get_lead: 'Opening a lead',
  search_places: 'Searching Google Maps',
  track_places: 'Tracking businesses',
  track_websites: 'Tracking websites',
  write_drafts: 'Writing messages',
  update_lead_status: 'Updating the pipeline',
  list_hunts: 'Checking hunts',
  create_hunt: 'Creating a hunt',
  run_hunt: 'Running a hunt',
};

/** Splits a server-sent event stream into `{ event, data }` messages. */
export async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      yield { event, data: data ? (JSON.parse(data) as Record<string, string>) : {} };
    }
  }
}

/**
 * A conversation with Arclight. It can look up leads, search Google Maps, write drafts and manage
 * hunts; it never sends messages to prospects. The conversation lives only in this component.
 */
export function Chat({
  placeholder = 'Ask Arclight, e.g. "What should I do today?"',
}: {
  placeholder?: string;
}) {
  const { basePath } = useArclight();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);

  const scroll = () =>
    requestAnimationFrame(() => log.current?.scrollTo({ top: log.current.scrollHeight }));

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history: Turn[] = [...turns, { role: 'user', content: question }];
    setTurns([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setError(null);
    scroll();

    const answer = (update: (text: string) => string) =>
      setTurns((current) => {
        const next = [...current];
        const last = next.at(-1)!;
        next[next.length - 1] = { ...last, content: update(last.content) };
        return next;
      });

    try {
      const response = await fetch(`${basePath}/v1/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-50) }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Arclight answered with HTTP ${response.status}.`);
      }
      for await (const { event: type, data } of readEvents(response.body)) {
        if (type === 'text') {
          setActivity(null);
          answer((text) => text + data.delta);
          scroll();
        } else if (type === 'tool') {
          setActivity(data.status === 'start' ? (TOOL_LABELS[data.name!] ?? 'Working') : null);
        } else if (type === 'done') {
          answer(() => data.text ?? '');
        } else if (type === 'error') {
          throw new Error(data.message);
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Arclight is not reachable.');
      // Drop the unanswered question's empty answer so the conversation stays consistent.
      setTurns((current) => (current.at(-1)?.content ? current : current.slice(0, -1)));
    } finally {
      setBusy(false);
      setActivity(null);
    }
  }

  return (
    <section className="arc-card arc-chat">
      <div className="arc-chat-log" ref={log} aria-live="polite">
        {turns.length === 0 && (
          <p className="arc-muted">
            Ask about your leads, find new ones on Google Maps, or have Arclight write a message. It
            never sends anything itself.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`arc-chat-turn arc-chat-${turn.role}`}>
            {turn.content || (busy && i === turns.length - 1 ? '…' : '')}
          </div>
        ))}
        {activity && <p className="arc-muted arc-small">{activity}…</p>}
      </div>
      {error && <p className="arc-error">{error}</p>}
      <form className="arc-chat-form" onSubmit={send}>
        <input
          className="arc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          aria-label="Message to Arclight"
          maxLength={20_000}
        />
        <button type="submit" className="arc-button" disabled={busy || !input.trim()}>
          {busy ? 'Working…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
