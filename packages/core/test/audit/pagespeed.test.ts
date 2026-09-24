import { describe, expect, it } from 'vitest';
import { pageSpeedSignals, parsePageSpeed } from '../../src/audit/pagespeed.ts';

describe('PageSpeed Insights', () => {
  it('parses the API response', () => {
    expect(
      parsePageSpeed({
        lighthouseResult: {
          categories: { performance: { score: 0.34 } },
          audits: { 'largest-contentful-paint': { numericValue: 8900 } },
        },
        loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 5200 } } },
      }),
    ).toEqual({ performanceScore: 34, lcpMs: 8900, fieldLcpMs: 5200 });
    expect(parsePageSpeed({})).toEqual({ performanceScore: null, lcpMs: null, fieldLcpMs: null });
  });

  it('turns slow results into need signals, preferring real-user data', () => {
    const signals = pageSpeedSignals({ performanceScore: 34, lcpMs: 8900, fieldLcpMs: 5200 });
    expect(signals.map((s) => [s.key, s.points])).toEqual([
      ['slow_mobile', 25],
      ['slow_lcp', 10],
    ]);
    expect(signals[1]?.evidence).toBe(
      'For real visitors on phones, the main content takes 5.2 s to appear.',
    );
  });

  it('reports nothing for a fast site', () => {
    expect(pageSpeedSignals({ performanceScore: 95, lcpMs: 1800, fieldLcpMs: null })).toEqual([]);
  });
});
