import 'server-only';
import { createJarvisClient, type JarvisClient } from '@jarvis/sdk';

/**
 * The dashboard is a client of the public JARVIS API, exactly like any other website that embeds
 * JARVIS. The API key stays on the server.
 */
export function getJarvis(): JarvisClient | null {
  const baseUrl = process.env.JARVIS_API_URL;
  const apiKey = process.env.JARVIS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return createJarvisClient({ baseUrl, apiKey });
}
