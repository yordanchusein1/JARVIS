/**
 * Google Places API (New) client.
 *
 * The Google Maps Platform Terms forbid storing Places content such as names, addresses or
 * reviews; only the place ID may be kept (docs/DECISIONS.md, D3). Everything returned here is
 * for immediate display or processing and must not be written to the database.
 */

export interface PlaceSummary {
  placeId: string;
  name: string | null;
  address: string | null;
  websiteUrl: string | null;
  phone: string | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string | null;
}

export interface SearchOptions {
  /** Up to 60; Google returns at most 20 places per page and 3 pages per search. */
  maxResults?: number;
}

export interface PlacesClient {
  searchText(query: string, options?: SearchOptions): Promise<PlaceSummary[]>;
  getPlace(placeId: string): Promise<PlaceSummary | null>;
}

const BASE = 'https://places.googleapis.com/v1';
const FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'websiteUri',
  'internationalPhoneNumber',
  'rating',
  'userRatingCount',
  'googleMapsUri',
];

interface PlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

export function parsePlace(place: PlaceResponse): PlaceSummary | null {
  if (!place.id) return null;
  return {
    placeId: place.id,
    name: place.displayName?.text ?? null,
    address: place.formattedAddress ?? null,
    websiteUrl: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber?.replace(/[^\d+]/g, '') ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    mapsUrl: place.googleMapsUri ?? null,
  };
}

export function createPlacesClient(
  apiKey: string,
  { fetchImpl = globalThis.fetch, timeoutMs = 20_000, languageCode = 'id' } = {},
): PlacesClient {
  async function call(path: string, fields: string[], init: RequestInit = {}): Promise<unknown> {
    const response = await fetchImpl(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
        'x-goog-fieldmask': fields.join(','),
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        `Google Places returned HTTP ${response.status}: ${body?.error?.message ?? 'unknown error'}`,
      );
    }
    return response.json();
  }

  return {
    async searchText(query, { maxResults = 20 } = {}) {
      const limit = Math.max(1, Math.min(60, maxResults));
      const results: PlaceSummary[] = [];
      let pageToken: string | undefined;
      do {
        let body: { places?: PlaceResponse[]; nextPageToken?: string } | null;
        try {
          body = (await call(
            '/places:searchText',
            [...FIELDS.map((f) => `places.${f}`), 'nextPageToken'],
            {
              method: 'POST',
              body: JSON.stringify({
                textQuery: query,
                // Google requires every page request to repeat the first request's parameters.
                pageSize: Math.min(20, limit),
                languageCode,
                pageToken,
              }),
            },
          )) as typeof body;
        } catch (error) {
          // A later page failing still leaves the earlier results usable.
          if (results.length > 0) break;
          throw error;
        }
        results.push(
          ...(body?.places ?? []).map(parsePlace).filter((p): p is PlaceSummary => p !== null),
        );
        pageToken = body?.nextPageToken;
      } while (pageToken && results.length < limit);
      return results.slice(0, limit);
    },
    async getPlace(placeId) {
      const body = (await call(
        `/places/${encodeURIComponent(placeId)}?languageCode=${languageCode}`,
        FIELDS,
      )) as PlaceResponse | null;
      return body ? parsePlace(body) : null;
    },
  };
}
