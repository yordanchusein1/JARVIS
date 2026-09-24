import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

export function connectDatabase(url: string): DatabaseConnection {
  const sql = postgres(url, { onnotice: () => {} });
  return {
    db: drizzle(sql, { schema }),
    close: () => sql.end(),
  };
}

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Applies pending migrations. The API, the worker and CLI commands all call this on start-up, so a
 * PostgreSQL advisory lock makes concurrent callers wait for each other instead of racing.
 */
export async function runMigrations(url: string): Promise<void> {
  // A single connection, so the session-level lock covers every migration query.
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(hashtext('arclight:migrations'))`;
    await migrate(drizzle(sql), { migrationsFolder });
  } finally {
    await sql.end();
  }
}
