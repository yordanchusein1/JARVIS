import { connectDatabase, createApiKey, runMigrations } from '@arclight/core';

const name = process.argv[2];
const url = process.env.DATABASE_URL;

if (!name || !url) {
  console.error('Usage: DATABASE_URL=... pnpm api-key:create <name>');
  process.exit(1);
}

await runMigrations(url);
const { db, close } = connectDatabase(url);
try {
  const created = await createApiKey(db, name);
  console.log(`Created API key "${created.name}". Store it now; it will not be shown again:\n`);
  console.log(created.key);
} finally {
  await close();
}
