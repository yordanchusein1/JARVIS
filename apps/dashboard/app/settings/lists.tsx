'use client';

import { useActionState } from 'react';
import type { components } from '@arclighthq/sdk';
import { addDoNotContactAction, saveWeightsAction, type ProfileState } from './actions';

type Insight = components['schemas']['SignalInsight'];

export function DoNotContactForm() {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    addDoNotContactAction,
    {},
  );
  return (
    <form action={action} className="actions">
      <select name="kind" className="input compact" aria-label="Kind">
        <option value="domain">Website domain</option>
        <option value="email">Email</option>
        <option value="phone">Phone / WhatsApp</option>
      </select>
      <input
        name="value"
        className="input grow"
        placeholder="klinik.co.id"
        required
        aria-label="Value"
      />
      <input
        name="reason"
        className="input grow"
        placeholder="Reason (optional)"
        aria-label="Reason"
      />
      <button type="submit" className="button secondary" disabled={pending}>
        Add
      </button>
      {state.error && <p className="error small">{state.error}</p>}
    </form>
  );
}

export function WeightsForm({ insights }: { insights: Insight[] }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveWeightsAction, {});
  return (
    <form action={action} className="weights">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Axis</th>
              <th className="num">Leads</th>
              <th className="num">👍</th>
              <th className="num">👎</th>
              <th className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {insights.map((s) => (
              <tr key={s.key}>
                <td>
                  <code>{s.key}</code>
                </td>
                <td className="muted">{s.axis}</td>
                <td className="num">{s.leads}</td>
                <td className="num">{s.good}</td>
                <td className="num">{s.bad}</td>
                <td className="num">
                  <input type="hidden" name={`default:${s.key}`} value={s.defaultPoints} />
                  <input
                    className="input compact"
                    type="number"
                    min={0}
                    max={100}
                    name={`weight:${s.key}`}
                    defaultValue={s.points}
                    aria-label={`Points for ${s.key}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Saving…' : 'Save weights'}
        </button>
        {state.error && <span className="error">{state.error}</span>}
        {state.message && <span className="success">{state.message}</span>}
      </p>
    </form>
  );
}
