'use client';

import { useActionState } from 'react';
import type { components } from '@arclighthq/sdk';
import { submitKeepingInput } from '../submit';
import { saveProfileAction, type ProfileState } from './actions';

type Profile = components['schemas']['AgencyProfile'];

export function ProfileForm({ profile, timeZones }: { profile: Profile; timeZones: string[] }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});

  return (
    <form onSubmit={submitKeepingInput(action)} className="card">
      <label className="label" htmlFor="agencyName">
        Agency name
      </label>
      <input
        className="input"
        id="agencyName"
        name="agencyName"
        defaultValue={profile.agencyName}
        placeholder="Vera & Co"
        required
      />

      <label className="label" htmlFor="senderName">
        Your name (the sender)
      </label>
      <input
        className="input"
        id="senderName"
        name="senderName"
        defaultValue={profile.senderName}
        required
      />

      <label className="label" htmlFor="services">
        What you offer
      </label>
      <textarea
        className="input"
        id="services"
        name="services"
        rows={3}
        defaultValue={profile.services}
        placeholder="Website design and development for clinics, schools and hotels"
        required
      />

      <label className="label" htmlFor="tone">
        Tone
      </label>
      <input
        className="input"
        id="tone"
        name="tone"
        defaultValue={profile.tone}
        placeholder="friendly and professional"
      />

      <label className="label" htmlFor="language">
        Message language
      </label>
      <select className="input" id="language" name="language" defaultValue={profile.language}>
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </select>

      <label className="label" htmlFor="timezone">
        Time zone
      </label>
      <input
        className="input"
        id="timezone"
        name="timezone"
        list="timezones"
        defaultValue={profile.timezone}
        placeholder="Asia/Jakarta"
        required
      />
      <datalist id="timezones">
        {timeZones.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      <p className="muted small">Hunts run and the daily briefing is counted in this time zone.</p>

      <label className="label" htmlFor="followUpDays">
        Follow up after (days)
      </label>
      <input
        className="input"
        id="followUpDays"
        name="followUpDays"
        type="number"
        min={1}
        max={60}
        defaultValue={profile.followUpDays}
        required
      />
      <p className="muted small">
        A contacted lead without a reply shows up in the briefing after this many days.
      </p>

      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p className="success">{state.message}</p>}
    </form>
  );
}
