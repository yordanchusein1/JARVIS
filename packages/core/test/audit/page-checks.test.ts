import { describe, expect, it } from 'vitest';
import { analyzePage } from '../../src/audit/page-checks.ts';
import type { FetchedPage } from '../../src/audit/safe-fetch.ts';

const now = new Date('2026-09-24T00:00:00Z');

function page(url: string, body: string, status = 200): FetchedPage {
  return { url, status, body, headers: new Headers(), redirects: [url] };
}

const OUTDATED = `<!doctype html><html><head>
  <title>Klinik Gigi Senyum | Dokter Gigi Surabaya</title>
  <meta name="generator" content="WordPress 4.9.8">
  <script src="/js/jquery-1.11.3.min.js"></script>
</head><body>
  <a href="/tim-dokter">Tim Dokter</a>
  <a href="/karir">Karir</a>
  <p>Kami memiliki 3 cabang: Surabaya, Sidoarjo dan Gresik.</p>
  <a href="tel:031-555-1234">Telepon</a>
  <a href="mailto:info@klinikgigisenyum.co.id">Email</a>
  <a href="https://www.instagram.com/klinikgigisenyum/">Instagram</a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
  <footer>© 2012 - 2019 Klinik Gigi Senyum</footer>
</body></html>`;

const MODERN = `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:site_name" content="Sekolah Harapan">
  <title>Beranda</title>
</head><body>
  <form><input type="email" name="email"><textarea></textarea></form>
  <a href="https://wa.me/6281234567890">Chat WhatsApp</a>
  <p>Hubungi kami: admin.sekolah@gmail.com</p>
  <footer>© 2026 Sekolah Harapan</footer>
</body></html>`;

describe('analyzePage', () => {
  it('finds needs, capacity signals and contacts on an outdated site', () => {
    const result = analyzePage(page('http://klinikgigisenyum.co.id/', OUTDATED), { now });
    const keys = result.signals.map((s) => s.key).sort();

    expect(keys).toEqual(
      [
        'business_email',
        'careers_page',
        'legacy_jquery',
        'multiple_locations',
        'no_contact_form',
        'no_https',
        'no_viewport',
        'no_whatsapp',
        'old_wordpress',
        'outdated_copyright',
        'own_domain',
        'social_presence',
        'team_page',
      ].sort(),
    );
    const evidence = (key: string) => result.signals.find((s) => s.key === key)?.evidence;
    expect(evidence('outdated_copyright')).toContain('2019');
    expect(evidence('multiple_locations')).toBe(
      'Mentions multiple locations: "Kami memiliki 3 cabang: Surabaya, Sidoarjo dan Gresik."',
    );
    expect(evidence('social_presence')).toBe('Links to its Instagram from the website.');
    expect(result.displayName).toBe('Klinik Gigi Senyum');
    expect(result.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'email', value: 'info@klinikgigisenyum.co.id' }),
        expect.objectContaining({ kind: 'phone', value: '+62315551234' }),
        expect.objectContaining({
          kind: 'instagram',
          value: 'https://instagram.com/klinikgigisenyum',
        }),
      ]),
    );
    expect(result.contacts.some((c) => c.kind === 'facebook')).toBe(false);
  });

  it('finds few needs on a modern site', () => {
    const result = analyzePage(page('https://www.sekolahharapan.sch.id/', MODERN), { now });
    const needs = result.signals.filter((s) => s.axis === 'need').map((s) => s.key);

    expect(needs).toEqual([]);
    expect(result.displayName).toBe('Sekolah Harapan');
    expect(result.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'whatsapp', value: '+6281234567890' }),
        expect.objectContaining({ kind: 'email', value: 'admin.sekolah@gmail.com' }),
      ]),
    );
    // A Gmail address is not a sign of an established business.
    expect(result.signals.some((s) => s.key === 'business_email')).toBe(false);
  });

  it('flags free subdomains and error pages', () => {
    const result = analyzePage(page('https://klinik.wixsite.com/home', '<html></html>', 500), {
      now,
    });
    const keys = result.signals.map((s) => s.key);
    expect(keys).toContain('free_subdomain');
    expect(keys).toContain('http_error');
    expect(keys).not.toContain('own_domain');
  });
});
