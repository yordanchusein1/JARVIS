'use client';

import { useActionState } from 'react';
import type { components } from '@arclight/sdk';
import { saveProfileAction, type ProfileState } from './actions';

type Profile = components['schemas']['AgencyProfile'];

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});

  return (
    <form action={action} className="card">
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

      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p className="success">{state.message}</p>}
    </form>
  );
}
