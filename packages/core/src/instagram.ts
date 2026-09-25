/**
 * Instagram Business Discovery (Instagram Graph API): public numbers of other business and
 * creator accounts, read through the agency's own Instagram business account. This is Meta's
 * official API; Arclight never scrapes Instagram (docs/DECISIONS.md, D3 and D9).
 */
import type { SignalInput } from './audit/types.ts';

export interface InstagramProfile {
  username: string;
  followers: number | null;
  posts: number | null;
  lastPostAt: Date | null;
}

export interface InstagramClient {
  /** The account's public numbers, or null if it isn't a business or creator account. */
  businessDiscovery(username: string): Promise<InstagramProfile | null>;
}

const USERNAME = /^[a-z0-9._]{1,30}$/;

/** "https://instagram.com/klinik.senyum", "@klinik.senyum" or "klinik.senyum" → "klinik.senyum". */
export function instagramUsername(value: string): string | null {
  let candidate = value.trim();
  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    if (/(^|\.)instagram\.com$/i.test(url.hostname)) {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
  } catch {
    // Not a URL: treat it as a handle.
  }
  const username = candidate.replace(/^@/, '').toLowerCase();
  if (!USERNAME.test(username) || ['p', 'reel', 'reels', 'explore', 'stories'].includes(username)) {
    return null;
  }
  return username;
}

export class InstagramError extends Error {
  override name = 'InstagramError';
}

export function createInstagramClient({
  accessToken,
  accountId,
  version = 'v23.0',
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
}: {
  accessToken: string;
  /** The agency's own Instagram business account id, which makes the lookups. */
  accountId: string;
  version?: string;
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
}): InstagramClient {
  return {
    async businessDiscovery(username) {
      const fields = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(1){timestamp}}`;
      const url = new URL(`https://graph.facebook.com/${version}/${accountId}`);
      url.searchParams.set('fields', fields);
      url.searchParams.set('access_token', accessToken);
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      const body = (await response.json().catch(() => null)) as {
        business_discovery?: {
          username?: string;
          followers_count?: number;
          media_count?: number;
          media?: { data?: { timestamp?: string }[] };
        };
        error?: { message?: string; code?: number; error_subcode?: number };
      } | null;
      if (!response.ok || !body?.business_discovery) {
        // Code 110 / subcode 2207013: the username doesn't belong to a business or creator account.
        if (body?.error?.code === 110 || body?.error?.error_subcode === 2207013) return null;
        throw new InstagramError(
          `Instagram returned HTTP ${response.status}: ${body?.error?.message ?? 'unknown error'}`,
        );
      }
      const found = body.business_discovery;
      const latest = found.media?.data?.[0]?.timestamp;
      return {
        username: found.username ?? username,
        followers: found.followers_count ?? null,
        posts: found.media_count ?? null,
        lastPostAt: latest ? new Date(latest) : null,
      };
    },
  };
}

const DAY = 24 * 60 * 60 * 1000;
const number = new Intl.NumberFormat('en-US');

/** Capacity and need signals from an Instagram profile, each with readable evidence. */
export function instagramSignals(profile: InstagramProfile, now = new Date()): SignalInput[] {
  const handle = `@${profile.username}`;
  const data = {
    username: profile.username,
    followers: profile.followers,
    posts: profile.posts,
    lastPostAt: profile.lastPostAt?.toISOString() ?? null,
  };
  const signals: SignalInput[] = [];

  const followers = profile.followers ?? 0;
  const followerPoints =
    followers >= 10_000 ? 25 : followers >= 2_000 ? 15 : followers >= 500 ? 5 : 0;
  if (followerPoints > 0) {
    signals.push({
      axis: 'capacity',
      key: 'instagram_followers',
      points: followerPoints,
      evidence: `Has ${number.format(followers)} followers on Instagram (${handle}).`,
      data,
    });
  }

  const days = profile.lastPostAt
    ? Math.floor((now.getTime() - profile.lastPostAt.getTime()) / DAY)
    : null;
  if (days !== null && days <= 30) {
    signals.push({
      axis: 'capacity',
      key: 'instagram_active',
      points: 10,
      evidence: `Posted on Instagram ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`} (${handle}), so the business is active.`,
      data,
    });
  } else if (days === null || days > 180) {
    signals.push({
      axis: 'need',
      key: 'instagram_inactive',
      points: 10,
      evidence:
        days === null
          ? `The Instagram account ${handle} has no posts.`
          : `The Instagram account ${handle} hasn't posted for ${Math.floor(days / 30)} months.`,
      data,
    });
  }
  return signals;
}
