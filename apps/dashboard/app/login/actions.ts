'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionSecret,
} from '@/lib/session';

export interface LoginState {
  error?: string;
}

// Failed attempts per client address, to slow down password guessing. In memory, so it resets on
// restart; enough for a single-instance, self-hosted dashboard.
const failures = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const secret = sessionSecret();
  if (!secret || !process.env.DASHBOARD_PASSWORD) {
    return { error: 'Sign-in is not configured. Set DASHBOARD_PASSWORD and SESSION_SECRET.' };
  }

  const address = await clientAddress();
  const now = Date.now();
  const record = failures.get(address);
  if (record && now - record.since < WINDOW_MS && record.count >= MAX_FAILURES) {
    return { error: 'Too many failed attempts. Try again in 15 minutes.' };
  }

  if (!(await checkPassword(String(form.get('password') ?? ''), secret))) {
    const fresh = !record || now - record.since >= WINDOW_MS;
    failures.set(address, {
      count: fresh ? 1 : record.count + 1,
      since: fresh ? now : record.since,
    });
    return { error: 'Wrong password.' };
  }

  failures.delete(address);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
