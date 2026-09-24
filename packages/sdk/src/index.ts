import createClient, { type Client } from 'openapi-fetch';
import type { components, paths } from './schema.d.ts';

export type { components, paths };
export type Business = components['schemas']['Business'];
export type ApiError = components['schemas']['Error'];

export interface JarvisClientOptions {
  /** Base URL of the JARVIS API, e.g. `http://localhost:8787`. */
  baseUrl: string;
  /** API key. Use it only on a server; never ship it to a browser. */
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export type JarvisClient = Client<paths>;

export function createJarvisClient({ baseUrl, apiKey, fetch }: JarvisClientOptions): JarvisClient {
  return createClient<paths>({
    baseUrl: `${baseUrl.replace(/\/+$/, '')}/v1`,
    headers: { Authorization: `Bearer ${apiKey}` },
    fetch,
  });
}
