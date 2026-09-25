'use client';

import { useActionState } from 'react';
import { submitKeepingInput } from '../../submit';
import { instagramAction } from './actions';

/** Lets a person add the Instagram account of a business, e.g. one without a website. */
export function InstagramForm({ id, current }: { id: string; current: string | null }) {
  const [state, action, pending] = useActionState(instagramAction.bind(null, id), {});
  return (
    <form onSubmit={submitKeepingInput(action)} className="actions">
      <input
        name="instagram"
        className="input grow"
        defaultValue={current ?? ''}
        placeholder="@klinik.senyum or instagram.com/klinik.senyum"
        aria-label="Instagram account"
      />
      <button type="submit" className="button secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save Instagram'}
      </button>
      {state.error && <span className="error small">{state.error}</span>}
      {state.message && <span className="success small">{state.message}</span>}
    </form>
  );
}
