import { sql } from 'drizzle-orm';
import { connectDatabase, runMigrations, type DatabaseConnection } from '../src/db/client.ts';

/** Connects to DATABASE_URL, applies migrations, and returns a helper that empties all tables. */
export async function setupTestDatabase(): Promise<
  DatabaseConnection & { reset: () => Promise<void> }
> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must point to a disposable test database');
  await runMigrations(url);
  const connection = connectDatabase(url);
  return {
    ...connection,
    reset: async () => {
      await connection.db.execute(
        sql`TRUNCATE agency_profile, drafts, api_keys, businesses, audits, signals, contact_channels, activity_log, do_not_contact CASCADE`,
      );
    },
  };
}
