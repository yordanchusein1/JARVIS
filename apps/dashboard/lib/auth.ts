import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from './session';

/** True when the current request carries a valid admin session. */
export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, sessionSecret());
}

/** Redirects to the sign-in page unless the request is signed in. */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) redirect('/login');
}
