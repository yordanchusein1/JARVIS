import createClient, { type Client } from 'openapi-fetch';
import type { components, paths } from './schema.d.ts';

export type { components, paths };
export type Business = components['schemas']['Business'];
export type ApiError = components['schemas']['Error'];
export type Hunt = components['schemas']['Hunt'];
export type HuntRun = components['schemas']['HuntRun'];
export type Briefing = components['schemas']['Briefing'];

export interface ArclightClientOptions {
  /** Base URL of the Arclight API, e.g. `http://localhost:8787`. */
  baseUrl: string;
  /** API key. Use it only on a server; never ship it to a browser. */
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export type ArclightClient = Client<paths>;

export function createArclightClient({
  baseUrl,
  apiKey,
  fetch,
}: ArclightClientOptions): ArclightClient {
  return createClient<paths>({
    baseUrl: `${baseUrl.replace(/\/+$/, '')}/v1`,
    headers: { Authorization: `Bearer ${apiKey}` },
    fetch,
  });
}
