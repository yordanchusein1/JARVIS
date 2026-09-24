/**
 * Stateless admin session: a signed, expiring token in an HttpOnly cookie. Uses Web Crypto so it
 * runs in the proxy as well as in server components and actions.
 */

export const SESSION_COOKIE = 'arclight_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** The signing secret, or null when the dashboard is not configured for sign-in. */
export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Compares two byte arrays in constant time. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload = base64url(
    encoder.encode(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })),
  );
  return `${payload}.${base64url(await hmac(secret, payload))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | null,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!equalBytes(await hmac(secret, payload), Buffer.from(signature, 'base64url'))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof exp === 'number' && exp > now / 1000;
  } catch {
    return false;
  }
}

/** Checks a password against DASHBOARD_PASSWORD without leaking timing information. */
export async function checkPassword(candidate: string, secret: string): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  // Comparing HMACs gives equal-length inputs, so the comparison time does not depend on the password.
  return equalBytes(await hmac(secret, candidate), await hmac(secret, expected));
}
