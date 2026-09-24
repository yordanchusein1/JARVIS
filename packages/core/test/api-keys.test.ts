import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiKey, revokeApiKey, verifyApiKey } from '../src/api-keys.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;

beforeEach(() => database.reset());
afterAll(() => database.close());

describe('API keys', () => {
  it('verifies a created key and rejects others', async () => {
    const created = await createApiKey(db, 'dashboard');

    expect(created.key).toMatch(/^jrv_[\w-]{43}$/);
    expect((await verifyApiKey(db, created.key))?.id).toBe(created.id);
    expect(await verifyApiKey(db, `${created.key}x`)).toBeNull();
    expect(await verifyApiKey(db, 'not-a-key')).toBeNull();
  });

  it('rejects a revoked key', async () => {
    const created = await createApiKey(db, 'old');
    await revokeApiKey(db, created.id);

    expect(await verifyApiKey(db, created.key)).toBeNull();
  });
});
