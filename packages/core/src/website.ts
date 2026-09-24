export class InvalidWebsiteError extends Error {
  override name = 'InvalidWebsiteError';
}

export interface NormalizedWebsite {
  /** URL to visit, with scheme, lower-cased host and no fragment. */
  url: string;
  /** De-duplication key: host without "www.", optional port, and path without trailing slash. */
  key: string;
}

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const PRIVATE_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa'];

/**
 * Validates and normalises a website address typed or pasted by a user, e.g. `klinik.co.id`.
 *
 * This only rejects addresses that can never be a public business website. Fetching a website
 * must still guard against private addresses after DNS resolution.
 */
export function normalizeWebsite(input: string): NormalizedWebsite {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidWebsiteError('Website is empty');

  let parsed: URL;
  try {
    parsed = new URL(SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new InvalidWebsiteError('Not a valid website address');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidWebsiteError('Only http and https websites are supported');
  }
  if (parsed.username || parsed.password) {
    throw new InvalidWebsiteError('Website addresses must not contain credentials');
  }

  // The URL parser already lower-cases the host and turns numeric forms like 0x7f.1 into IPv4.
  const host = parsed.hostname;
  if (IPV4.test(host) || host.startsWith('[')) {
    throw new InvalidWebsiteError('Use the domain name, not an IP address');
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new InvalidWebsiteError('Website must be on a public domain');
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  const port = parsed.port ? `:${parsed.port}` : '';

  return {
    url: `${parsed.protocol}//${host}${port}${path || '/'}${parsed.search}`,
    key: `${host.replace(/^www\./, '')}${port}${path}`,
  };
}
