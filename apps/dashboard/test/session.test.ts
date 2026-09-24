import { afterEach, describe, expect, it } from 'vitest';
import {
  checkPassword,
  createSessionToken,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from '../lib/session';

const SECRET = 'a'.repeat(32);

describe('session tokens', () => {
  it('accepts a fresh token and rejects expired, tampered or foreign ones', async () => {
    const now = Date.UTC(2026, 8, 24);
    const token = await createSessionToken(SECRET, now);

    expect(await verifySessionToken(token, SECRET, now)).toBe(true);
    expect(await verifySessionToken(token, SECRET, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(
      false,
    );
    expect(await verifySessionToken(token, 'b'.repeat(32), now)).toBe(false);
    expect(await verifySessionToken(token, null, now)).toBe(false);

    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString('base64url');
    expect(await verifySessionToken(`${forged}.${signature}`, SECRET, now)).toBe(false);
    expect(await verifySessionToken(`${payload}.`, SECRET, now)).toBe(false);
    expect(await verifySessionToken('garbage', SECRET, now)).toBe(false);
    expect(await verifySessionToken(undefined, SECRET, now)).toBe(false);
  });
});

describe('checkPassword', () => {
  afterEach(() => {
    delete process.env.DASHBOARD_PASSWORD;
  });

  it('matches only the configured password', async () => {
    process.env.DASHBOARD_PASSWORD = 'rahasia-panjang';
    expect(await checkPassword('rahasia-panjang', SECRET)).toBe(true);
    expect(await checkPassword('rahasia', SECRET)).toBe(false);
    expect(await checkPassword('', SECRET)).toBe(false);
  });

  it('rejects everything when no password is configured', async () => {
    expect(await checkPassword('', SECRET)).toBe(false);
  });
});
