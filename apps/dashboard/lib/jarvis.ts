import 'server-only';
import { createJarvisClient, type JarvisClient } from '@jarvis/sdk';
import { requireSession } from './auth';

/**
 * The dashboard is a client of the public JARVIS API, exactly like any other website that embeds
 * JARVIS. The API key stays on the server.
 */
export async function getJarvis(): Promise<JarvisClient | null> {
  // Data access layer: nothing reaches the API without a valid admin session.
  await requireSession();
  const baseUrl = process.env.JARVIS_API_URL;
  const apiKey = process.env.JARVIS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return createJarvisClient({ baseUrl, apiKey });
}
