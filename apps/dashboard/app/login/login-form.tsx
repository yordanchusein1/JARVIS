'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="card login">
      <h1>Sign in</h1>
      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        className="input"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
      />
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}
