import createClient, { type Client } from 'openapi-fetch';
import type { components, paths } from './schema.d.ts';

export type { components, paths };
export type Business = components['schemas']['Business'];
export type ApiError = components['schemas']['Error'];
export type Hunt = components['schemas']['Hunt'];
export type HuntRun = components['schemas']['HuntRun'];
export type Briefing = components['schemas']['Briefing'];
export type BusinessDetail = components['schemas']['BusinessDetail'];
export type Draft = components['schemas']['Draft'];
export type Contact = components['schemas']['Contact'];
export type Place = components['schemas']['Place'];
export type LeadStatus = components['schemas']['LeadStatus'];
export { sendLinks, type SendLink } from './send-links.ts';

export interface ArclightClientOptions {
  /** Base URL of the Arclight API, e.g. `http://localhost:8787`. */
  baseUrl: string;
  /**
   * API key. Use it only on a server; never ship it to a browser. Omit it when `baseUrl` points to
   * a proxy that adds the key on the server, such as the handler from `@arclighthq/react/server`.
   */
  apiKey?: string;
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
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    fetch,
  });
}
