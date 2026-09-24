import 'server-only';
import { createArclightClient, type ArclightClient } from '@arclight/sdk';
import { requireSession } from './auth';

/**
 * The dashboard is a client of the public Arclight API, exactly like any other website that embeds
 * Arclight. The API key stays on the server.
 */
export async function getArclight(): Promise<ArclightClient | null> {
  // Data access layer: nothing reaches the API without a valid admin session.
  await requireSession();
  const baseUrl = process.env.Arclight_API_URL;
  const apiKey = process.env.Arclight_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return createArclightClient({ baseUrl, apiKey });
}
