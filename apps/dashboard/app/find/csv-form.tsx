'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { importCsvAction, type TrackState } from './actions';

export function CsvForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(importCsvAction, {});
  return (
    <form action={action} className="card">
      <label className="label" htmlFor="csv">
        Import a CSV
      </label>
      <input id="csv" name="csv" type="file" accept=".csv,text/csv" required />
      <p className="muted small">
        Arclight reads the column named website, url or domain (or any cell that looks like a
        website).
      </p>
      <button type="submit" className="button secondary" disabled={pending}>
        {pending ? 'Importing…' : 'Import'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && (
        <p className="success">
          {state.message} <Link href="/">See leads</Link>
        </p>
      )}
      {state.skipped && state.skipped.length > 0 && (
        <p className="muted small">
          Skipped {state.skipped.length} (invalid or on the do-not-contact list).
        </p>
      )}
    </form>
  );
}
