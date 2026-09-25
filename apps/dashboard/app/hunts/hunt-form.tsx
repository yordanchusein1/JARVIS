'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { Hunt } from '@arclighthq/sdk';
import { hourLabel } from '@/lib/format';
import { submitKeepingInput } from '../submit';
import { saveHuntAction, type HuntFormState } from './actions';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Creates a hunt, or edits one when `hunt` is given. */
export function HuntForm({
  hunt,
  timeZone,
  initialQuery,
}: {
  hunt?: Hunt;
  timeZone: string;
  /** Prefills a new hunt, e.g. from a search on the Find page. */
  initialQuery?: string;
}) {
  const [state, action, pending] = useActionState<HuntFormState, FormData>(saveHuntAction, {});
  const field = (name: string) => (hunt ? `${name}-${hunt.id}` : name);
  const form = useRef<HTMLFormElement>(null);
  // Clear the new-hunt form once the hunt exists; keep the input when saving failed.
  useEffect(() => {
    if (!hunt && state.message) form.current?.reset();
  }, [hunt, state]);

  return (
    <form ref={form} onSubmit={submitKeepingInput(action)} className="hunt-form">
      {hunt && <input type="hidden" name="id" value={hunt.id} />}
      <label className="label" htmlFor={field('query')}>
        Google Maps search
      </label>
      <input
        className="input"
        id={field('query')}
        name="query"
        defaultValue={hunt?.query ?? initialQuery}
        placeholder="klinik gigi Surabaya"
        minLength={2}
        maxLength={200}
        required
      />

      <div className="form-grid">
        <label className="small" htmlFor={field('runHour')}>
          <span className="label">Runs daily at</span>
          <select
            className="input"
            id={field('runHour')}
            name="runHour"
            defaultValue={hunt?.runHour ?? 7}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <span className="muted">{timeZone}</span>
        </label>
        <label className="small" htmlFor={field('maxNewPerRun')}>
          <span className="label">New leads per run</span>
          <input
            className="input"
            type="number"
            id={field('maxNewPerRun')}
            name="maxNewPerRun"
            min={1}
            max={50}
            defaultValue={hunt?.maxNewPerRun ?? 10}
          />
          <span className="muted">At most; most-reviewed first</span>
        </label>
        <label className="small" htmlFor={field('minReviews')}>
          <span className="label">Minimum Google reviews</span>
          <input
            className="input"
            type="number"
            id={field('minReviews')}
            name="minReviews"
            min={0}
            defaultValue={hunt?.minReviews ?? 0}
          />
          <span className="muted">Checked live, never stored</span>
        </label>
      </div>

      <label className="check">
        <input
          type="checkbox"
          name="includeNoWebsite"
          defaultChecked={hunt?.includeNoWebsite ?? true}
        />
        Include businesses without a website
      </label>
      <label className="check">
        <input type="checkbox" name="autoDraft" defaultChecked={hunt?.autoDraft ?? false} />
        Write drafts automatically for leads with a priority of at least
        <input
          className="input compact"
          type="number"
          name="autoDraftMinPriority"
          min={0}
          max={100}
          defaultValue={hunt?.autoDraftMinPriority ?? 50}
          aria-label="Minimum priority for automatic drafts"
        />
      </label>
      <p className="muted small">
        Drafts wait for you on the lead&apos;s page. Arclight never sends a message.
      </p>

      <p className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Saving…' : hunt ? 'Save hunt' : 'Create hunt'}
        </button>
        {state.error && <span className="error">{state.error}</span>}
        {state.message && <span className="success">{state.message}</span>}
      </p>
    </form>
  );
}

/** A submit button that shows progress while its form's action runs. */
export function PendingButton({
  children,
  pendingText,
  secondary,
  confirmText,
}: {
  children: string;
  pendingText: string;
  secondary?: boolean;
  confirmText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={secondary ? 'button secondary' : 'button'}
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
