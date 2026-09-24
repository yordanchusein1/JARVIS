import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch } from 'undici';

export const USER_AGENT = 'JARVIS-Audit/0.1 (+https://github.com/yordanchusein1/JARVIS)';

export class UnsafeTargetError extends Error {
  override name = 'UnsafeTargetError';
}

// Addresses a public business website can never legitimately resolve to.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

/** True if `address` is a public unicast IP address. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped?.[1]) return isPublicAddress(mapped[1]);
    return !blocked.check(address, 'ipv6');
  }
  return !blocked.check(address, 'ipv4');
}

type LookupFn = (
  hostname: string,
  callback: (error: Error | null, addresses: LookupAddress[]) => void,
) => void;

const systemLookup: LookupFn = (hostname, callback) => dnsLookup(hostname, { all: true }, callback);

export interface SafeFetcherOptions {
  /** DNS resolver; replaceable in tests. */
  lookup?: LookupFn;
  /** Decides which resolved addresses may be connected to. Defaults to public addresses only. */
  isAllowedAddress?: (address: string) => boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface FetchedPage {
  /** URL after following redirects. */
  url: string;
  status: number;
  headers: Headers;
  body: string;
  /** Every URL visited, starting with the requested one. */
  redirects: string[];
}

export type PageFetcher = (url: string) => Promise<FetchedPage>;

/**
 * Creates a fetcher for third-party websites that refuses to connect to private, loopback or
 * otherwise internal addresses. The check runs when each connection is opened, after DNS
 * resolution, so redirects and DNS rebinding cannot bypass it.
 */
export function createSafeFetcher({
  lookup = systemLookup,
  isAllowedAddress = isPublicAddress,
  timeoutMs = 15_000,
  maxBytes = 2_000_000,
  maxRedirects = 5,
}: SafeFetcherOptions = {}): PageFetcher {
  const dispatcher = new Agent({
    connect: {
      timeout: timeoutMs,
      lookup: (hostname, options, callback) => {
        const done = (error: Error | null, address = '', family = 4) => {
          if (options.all) {
            callback(error, error ? [] : [{ address, family }]);
          } else {
            callback(error, address, family);
          }
        };
        lookup(hostname, (error, addresses) => {
          if (error) return done(error);
          const unsafe = addresses.find((a) => !isAllowedAddress(a.address));
          if (unsafe) {
            return done(
              new UnsafeTargetError(
                `${hostname} resolves to a non-public address (${unsafe.address})`,
              ),
            );
          }
          const first = addresses[0];
          if (!first) return done(new Error(`${hostname} did not resolve`));
          done(null, first.address, first.family);
        });
      },
    },
  });

  return async (startUrl) => {
    const redirects = [startUrl];
    let url = startUrl;

    for (let hop = 0; ; hop++) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new UnsafeTargetError(`Refusing to follow ${parsed.protocol} URL`);
      }
      // Connections to IP literals skip DNS lookup, so check them here.
      const literal = parsed.hostname.replace(/^\[|\]$/g, '');
      if (isIP(literal) && !isAllowedAddress(literal)) {
        throw new UnsafeTargetError(`Refusing to connect to ${literal}`);
      }

      const response = await fetch(url, {
        dispatcher,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'accept-language': 'id,en;q=0.8',
        },
      }).catch((error: unknown) => {
        // fetch wraps connection errors; surface our own refusal so callers can recognise it.
        const cause = (error as { cause?: unknown }).cause;
        throw cause instanceof UnsafeTargetError ? cause : error;
      });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        if (hop >= maxRedirects) throw new Error(`Too many redirects from ${startUrl}`);
        url = new URL(location, url).toString();
        redirects.push(url);
        continue;
      }

      return {
        url,
        status: response.status,
        headers: response.headers as unknown as Headers,
        body: await readLimited(response.body, maxBytes),
        redirects,
      };
    }
  };
}

async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      // Keep what fits; a truncated page is still useful for the checks.
      chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
