import { describe, expect, it } from 'vitest';
import { isAllowedByRobots } from '../../src/audit/robots.ts';
import type { PageFetcher } from '../../src/audit/safe-fetch.ts';

const robots =
  (status: number, body: string): PageFetcher =>
  async (url) => ({
    url,
    status,
    body,
    headers: new Headers(),
    redirects: [url],
  });

describe('isAllowedByRobots', () => {
  it('honours a disallow rule for all crawlers', async () => {
    expect(
      await isAllowedByRobots(robots(200, 'User-agent: *\nDisallow: /'), 'https://a.id/'),
    ).toBe(false);
  });

  it('honours a rule aimed at JARVIS', async () => {
    const body = 'User-agent: JARVIS-Audit\nDisallow: /\n\nUser-agent: *\nAllow: /';
    expect(await isAllowedByRobots(robots(200, body), 'https://a.id/')).toBe(false);
  });

  it('allows when robots.txt is missing or unreadable', async () => {
    expect(await isAllowedByRobots(robots(404, ''), 'https://a.id/')).toBe(true);
    expect(await isAllowedByRobots(() => Promise.reject(new Error('down')), 'https://a.id/')).toBe(
      true,
    );
  });
});
