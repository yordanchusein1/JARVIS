import { parse, type HTMLElement } from 'node-html-parser';
import type { FetchedPage } from './safe-fetch.ts';
import type { ContactInput, SignalInput } from './types.ts';

export interface PageAnalysis {
  /** Name the business uses for itself on its website, if found. */
  displayName: string | null;
  signals: SignalInput[];
  contacts: ContactInput[];
}

const FREE_HOSTS = [
  'wixsite.com',
  'blogspot.com',
  'wordpress.com',
  'weebly.com',
  'webnode.page',
  'business.site',
  'carrd.co',
  'github.io',
  'netlify.app',
  'vercel.app',
  'sites.google.com',
  'mystrikingly.com',
  'jimdosite.com',
];

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.id',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'ymail.com',
]);

const SOCIAL_HOSTS: Record<string, 'instagram' | 'facebook' | 'tiktok' | 'linkedin'> = {
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'tiktok.com': 'tiktok',
  'linkedin.com': 'linkedin',
};

// Social links that point to a post or a share dialog rather than the business's profile.
const NON_PROFILE_PATH =
  /^\/(p|reel|reels|tv|explore|share|sharer|sharer\.php|intent|dialog|watch|video|hashtag|tag)(\/|$)/i;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IS_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const ASSET_EXTENSION = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

const CAREERS = /\b(karir|karier|careers?|lowongan|jobs|vacanc(y|ies)|rekrutmen|recruitment)\b/i;
const TEAM = /\b(tim kami|our team|team|dokter|doctors?|staff|pengajar|para guru|teachers)\b/i;
const LOCATIONS = /\b(cabang|branches|our locations|lokasi kami|outlet kami)\b/i;
const BOOKING =
  /\b(booking|book now|reservasi|reservation|appointment|janji temu|buat janji|daftar sekarang)\b/i;

export interface AnalyzeOptions {
  now?: Date;
  /** Country calling code for local phone numbers such as 0812…, without "+". */
  countryCode?: string;
}

export function analyzePage(
  page: FetchedPage,
  { now = new Date(), countryCode = '62' }: AnalyzeOptions = {},
): PageAnalysis {
  const root = parse(page.body, { comment: false });
  const finalUrl = new URL(page.url);
  const host = finalUrl.hostname.replace(/^www\./, '');
  // structuredText keeps block elements apart, so headings and paragraphs don't run together.
  const text = root.querySelector('body')?.structuredText.replace(/[^\S\n]+/g, ' ') ?? '';
  const links = root.querySelectorAll('a[href]').map((a) => ({
    href: a.getAttribute('href') ?? '',
    text: a.textContent.replace(/\s+/g, ' ').trim(),
  }));

  const signals: SignalInput[] = [];
  const need = (key: string, points: number, evidence: string, data?: Record<string, unknown>) =>
    signals.push({ axis: 'need', key, points, evidence, data });
  const capacity = (
    key: string,
    points: number,
    evidence: string,
    data?: Record<string, unknown>,
  ) => signals.push({ axis: 'capacity', key, points, evidence, data });

  // --- Need: gaps a web agency can fix -------------------------------------------------------

  if (page.status >= 400) {
    need('http_error', 40, `The homepage returned an error (HTTP ${page.status}).`, {
      status: page.status,
    });
  }

  if (finalUrl.protocol === 'http:') {
    need('no_https', 25, 'The website does not use HTTPS, so browsers label it "Not secure".');
  }

  const freeHost = FREE_HOSTS.find((h) => host === h || host.endsWith(`.${h}`));
  if (freeHost) {
    need('free_subdomain', 15, `The website runs on a free subdomain (${finalUrl.hostname}).`);
  } else {
    capacity('own_domain', 10, `Has its own domain (${host}).`);
  }

  if (!root.querySelector('meta[name="viewport" i]')) {
    need(
      'no_viewport',
      20,
      'The homepage has no mobile viewport setting, so it is not designed for phones.',
    );
  }

  const copyrightYear = findCopyrightYear(text);
  if (copyrightYear && copyrightYear <= now.getFullYear() - 3) {
    need('outdated_copyright', 10, `The copyright notice on the website says ${copyrightYear}.`, {
      year: copyrightYear,
    });
  }

  const scripts = root.querySelectorAll('script[src]').map((s) => s.getAttribute('src') ?? '');
  const oldJquery = scripts.find((src) => /jquery[.-]?(min\.)?1\.\d+|jquery\/1\.\d+/i.test(src));
  if (oldJquery) {
    need(
      'legacy_jquery',
      5,
      'The website loads jQuery 1.x, a library version that is no longer supported.',
    );
  }

  const generator = root.querySelector('meta[name="generator" i]')?.getAttribute('content') ?? '';
  const wordpress = /WordPress (\d+)\.(\d+)/i.exec(generator);
  if (wordpress && Number(wordpress[1]) < 6) {
    need(
      'old_wordpress',
      5,
      `The website runs an outdated WordPress version (${wordpress[1]}.${wordpress[2]}).`,
    );
  }

  const hasForm = root
    .querySelectorAll('form')
    .some((form) => form.querySelector('textarea, input[type="email" i], input[type="tel" i]'));
  const hasBooking = links.some((l) => BOOKING.test(l.text) || BOOKING.test(l.href));
  if (!hasForm && !hasBooking) {
    need('no_contact_form', 10, 'The homepage has no contact or booking form.');
  }

  // --- Capacity: signs of an established business --------------------------------------------

  const careers = links.find((l) => CAREERS.test(l.text) || CAREERS.test(l.href));
  if (careers) {
    capacity(
      'careers_page',
      20,
      `Has a careers page ("${careers.text || careers.href}"), so it is hiring.`,
    );
  }

  const team = links.find((l) => TEAM.test(l.text) || TEAM.test(l.href));
  if (team) {
    capacity('team_page', 10, `Presents its team on the website ("${team.text || team.href}").`);
  }

  const locations = LOCATIONS.exec(text);
  if (locations) {
    capacity(
      'multiple_locations',
      20,
      `Mentions multiple locations: "${sentenceAt(text, locations.index)}"`,
    );
  }

  // --- Contacts --------------------------------------------------------------------------------

  const contacts = extractContacts(root, links, page.url, host, countryCode);

  const businessEmail = contacts.find(
    (c) => c.kind === 'email' && !FREE_EMAIL_DOMAINS.has(c.value.split('@')[1] ?? ''),
  );
  if (businessEmail) {
    capacity(
      'business_email',
      10,
      `Uses an email address on its own domain (${businessEmail.value}).`,
    );
  }

  const socials = [...new Set(contacts.filter((c) => c.kind in PLATFORM_NAMES).map((c) => c.kind))];
  if (socials.length > 0) {
    capacity(
      'social_presence',
      Math.min(15, socials.length * 5),
      `Links to its ${listFormat.format(socials.map((k) => PLATFORM_NAMES[k] ?? k))} from the website.`,
    );
  }

  if (!contacts.some((c) => c.kind === 'whatsapp')) {
    need('no_whatsapp', 5, 'The homepage has no WhatsApp click-to-chat link.');
  }

  return { displayName: findDisplayName(root), signals, contacts };
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

function findDisplayName(root: HTMLElement): string | null {
  const siteName = root.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  const title = root.querySelector('title')?.textContent;
  const name = (siteName || title?.split(/\s[|–—-]\s/)[0] || '').replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 120) : null;
}

function findCopyrightYear(text: string): number | null {
  const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1995 && y <= 2100);
  return years.length > 0 ? Math.max(...years) : null;
}

/** The sentence containing `index`, shortened to at most 160 characters. */
function sentenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('. ', index) + 2, text.lastIndexOf('\n', index) + 1, 0);
  const endMatch = /[.!?](\s|$)/.exec(text.slice(index));
  const end = endMatch ? index + endMatch.index + 1 : text.length;
  const sentence = text.slice(start, end).trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
}

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function extractContacts(
  root: HTMLElement,
  links: { href: string; text: string }[],
  pageUrl: string,
  host: string,
  countryCode: string,
): ContactInput[] {
  const found = new Map<string, ContactInput>();
  const add = (kind: ContactInput['kind'], value: string) => {
    const key = `${kind}:${value}`;
    if (value && !found.has(key)) found.set(key, { kind, value, sourceUrl: pageUrl });
  };

  for (const { href } of links) {
    if (/^mailto:/i.test(href)) {
      const email = decodeURIComponent(href.slice(7).split('?')[0] ?? '')
        .trim()
        .toLowerCase();
      if (IS_EMAIL.test(email)) add('email', email);
      continue;
    }
    if (/^tel:/i.test(href)) {
      add('phone', normalizePhone(href.slice(4), countryCode));
      continue;
    }

    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    const linkHost = url.hostname.replace(/^(www|m|web)\./, '');

    if (linkHost === 'wa.me') {
      add('whatsapp', normalizePhone(url.pathname.slice(1), countryCode));
    } else if (linkHost === 'api.whatsapp.com' || linkHost === 'whatsapp.com') {
      const phone = url.searchParams.get('phone');
      if (phone) add('whatsapp', normalizePhone(phone, countryCode));
    } else if (
      SOCIAL_HOSTS[linkHost] &&
      !NON_PROFILE_PATH.test(url.pathname) &&
      url.pathname.length > 1
    ) {
      add(SOCIAL_HOSTS[linkHost], `https://${linkHost}${url.pathname.replace(/\/+$/, '')}`);
    }
  }

  const bodyText = root.querySelector('body')?.textContent ?? '';
  for (const match of bodyText.matchAll(EMAIL)) {
    const email = match[0].toLowerCase();
    if (!ASSET_EXTENSION.test(email)) add('email', email);
  }

  // Keep the list short and relevant: own-domain emails first.
  return [...found.values()]
    .sort((a, b) => Number(b.value.endsWith(`@${host}`)) - Number(a.value.endsWith(`@${host}`)))
    .filter((c, i, all) => all.filter((o, j) => j <= i && o.kind === c.kind).length <= 3);
}

/** Converts a phone number to international format, e.g. 0812-3456 → +628123456. */
function normalizePhone(raw: string, countryCode: string): string {
  const digits = decodeURIComponent(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+${countryCode}${digits.slice(1)}`;
  return `+${digits}`;
}
