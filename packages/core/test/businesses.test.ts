import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { activityLog } from '../src/db/schema.ts';
import { getBusiness, listBusinesses, trackWebsites } from '../src/businesses.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;

beforeAll(() => database.reset());
beforeEach(() => database.reset());
afterAll(() => database.close());

describe('trackWebsites', () => {
  it('creates one business per distinct website and reports invalid input', async () => {
    const result = await trackWebsites(db, [
      'klinik-a.co.id',
      'https://www.klinik-a.co.id/',
      'https://klinik-b.com',
      'localhost',
    ]);

    expect(result.created).toBe(2);
    expect(result.businesses.map((b) => b.websiteKey).sort()).toEqual([
      'klinik-a.co.id',
      'klinik-b.com',
    ]);
    expect(result.skipped).toEqual([
      { input: 'localhost', reason: 'Website must be on a public domain' },
    ]);
    expect(await db.select().from(activityLog)).toHaveLength(2);
  });

  it('returns existing businesses without duplicating them', async () => {
    const first = await trackWebsites(db, ['klinik-a.co.id']);
    const second = await trackWebsites(db, ['https://klinik-a.co.id', 'klinik-c.id']);

    expect(second.created).toBe(1);
    expect(second.businesses.map((b) => b.id)).toContain(first.businesses[0]?.id);
    expect(await listBusinesses(db)).toHaveLength(2);
  });
});

describe('getBusiness', () => {
  it('returns null for an unknown id', async () => {
    expect(await getBusiness(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
