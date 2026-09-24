import { connectDatabase, createApiKey, runMigrations } from '@jarvis/core';

const name = process.argv[2];
const url = process.env.DATABASE_URL;

if (!name || !url) {
  console.error('Usage: DATABASE_URL=... pnpm api-key:create <name>');
  process.exit(1);
}

const { db, close } = connectDatabase(url);
try {
  await runMigrations(db);
  const created = await createApiKey(db, name);
  console.log(`Created API key "${created.name}". Store it now; it will not be shown again:\n`);
  console.log(created.key);
} finally {
  await close();
}
