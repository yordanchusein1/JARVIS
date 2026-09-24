import robotsParser from 'robots-parser';
import { USER_AGENT, type PageFetcher } from './safe-fetch.ts';

/**
 * Checks whether the site's robots.txt lets JARVIS fetch `url`. A missing or unreadable
 * robots.txt means everything is allowed, as for search engines.
 */
export async function isAllowedByRobots(fetchPage: PageFetcher, url: string): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  try {
    const page = await fetchPage(robotsUrl);
    if (page.status !== 200) return true;
    return robotsParser(robotsUrl, page.body).isAllowed(url, USER_AGENT) ?? true;
  } catch {
    return true;
  }
}
