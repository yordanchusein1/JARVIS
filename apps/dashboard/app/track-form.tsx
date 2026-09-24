'use client';

import { useActionState } from 'react';
import { trackWebsitesAction, type TrackState } from './actions';

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackWebsitesAction, {});

  return (
    <form action={action} className="card">
      <label htmlFor="websites" className="label">
        Prospect websites
      </label>
      <textarea
        id="websites"
        name="websites"
        rows={4}
        placeholder={'klinik-contoh.co.id\nhttps://www.sekolah-contoh.sch.id'}
        className="input"
      />
      <p className="muted small">
        One website per line. Arclight audits each new one automatically.
      </p>
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Adding…' : 'Add websites'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p className="success">{state.message}</p>}
      {state.skipped && state.skipped.length > 0 && (
        <ul className="error small">
          {state.skipped.map((s) => (
            <li key={s.input}>
              <code>{s.input}</code>: {s.reason}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
