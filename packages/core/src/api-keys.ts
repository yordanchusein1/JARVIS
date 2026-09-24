import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from './db/client.ts';
import { apiKeys } from './db/schema.ts';

const KEY_PREFIX = 'arc_';

export interface CreatedApiKey {
  id: string;
  name: string;
  /** The full key. It is only available at creation time; the database stores a hash. */
  key: string;
}

export type ApiKey = typeof apiKeys.$inferSelect;

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(db: Database, name: string): Promise<CreatedApiKey> {
  const key = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ name, prefix: key.slice(0, KEY_PREFIX.length + 6), keyHash: hashKey(key) })
    .returning({ id: apiKeys.id, name: apiKeys.name });
  if (!row) throw new Error('Failed to create API key');
  return { ...row, key };
}

/** Returns the active key matching `key`, or null. Keys are random, so a hash lookup is safe. */
export async function verifyApiKey(db: Database, key: string): Promise<ApiKey | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const [row] = await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiKeys.keyHash, hashKey(key)), isNull(apiKeys.revokedAt)))
    .returning();
  return row ?? null;
}

export async function revokeApiKey(db: Database, id: string): Promise<void> {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
}
