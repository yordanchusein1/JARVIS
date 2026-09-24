import { connectDatabase, runMigrations } from './client.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { db, close } = connectDatabase(url);
try {
  await runMigrations(db);
  console.log('Migrations applied');
} finally {
  await close();
}
