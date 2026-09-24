import type { SignalInput } from './types.ts';

export interface PageSpeedResult {
  /** Lighthouse mobile performance score, 0–100. */
  performanceScore: number | null;
  /** Largest Contentful Paint in the lab test, in milliseconds. */
  lcpMs: number | null;
  /** Largest Contentful Paint measured on real Chrome users (p75), if Google has enough data. */
  fieldLcpMs: number | null;
}

export type PageSpeedClient = (url: string) => Promise<PageSpeedResult>;

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** Google PageSpeed Insights API client. The API is free but requires an API key. */
export function createPageSpeedClient(
  apiKey: string,
  { fetchImpl = globalThis.fetch, timeoutMs = 90_000 } = {},
): PageSpeedClient {
  return async (url) => {
    const query = new URLSearchParams({
      url,
      key: apiKey,
      strategy: 'mobile',
      category: 'performance',
    });
    const response = await fetchImpl(`${ENDPOINT}?${query}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        `PageSpeed Insights returned HTTP ${response.status}: ${body?.error?.message ?? 'unknown error'}`,
      );
    }
    return parsePageSpeed(await response.json());
  };
}

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, { numericValue?: number }>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
}

export function parsePageSpeed(json: unknown): PageSpeedResult {
  const data = json as PageSpeedResponse;
  const score = data.lighthouseResult?.categories?.performance?.score;
  return {
    performanceScore: typeof score === 'number' ? Math.round(score * 100) : null,
    lcpMs: data.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue ?? null,
    fieldLcpMs: data.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
  };
}

export function pageSpeedSignals(result: PageSpeedResult): SignalInput[] {
  const signals: SignalInput[] = [];
  const { performanceScore, lcpMs, fieldLcpMs } = result;

  if (performanceScore !== null && performanceScore < 90) {
    signals.push({
      axis: 'need',
      key: 'slow_mobile',
      points: performanceScore < 50 ? 25 : 10,
      evidence: `Google PageSpeed Insights rates the mobile performance ${performanceScore}/100.`,
      data: { performanceScore },
    });
  }

  // Prefer real-user data; fall back to the lab measurement.
  const lcp = fieldLcpMs ?? lcpMs;
  if (lcp !== null && lcp > 2500) {
    const seconds = (lcp / 1000).toFixed(1);
    signals.push({
      axis: 'need',
      key: 'slow_lcp',
      points: lcp > 4000 ? 10 : 5,
      evidence:
        fieldLcpMs !== null
          ? `For real visitors on phones, the main content takes ${seconds} s to appear.`
          : `In Google's mobile test, the main content takes ${seconds} s to appear.`,
      data: { lcpMs: lcp, field: fieldLcpMs !== null },
    });
  }

  return signals;
}
