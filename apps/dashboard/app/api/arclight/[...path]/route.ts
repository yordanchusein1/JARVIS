import { createArclightHandler } from '@arclighthq/react/server';
import { isSignedIn } from '@/lib/auth';

// Lets the browser components (the chat) reach the API. The key stays on this server, and only a
// signed-in admin gets through.
const handler = createArclightHandler({
  apiUrl: process.env.ARCLIGHT_API_URL,
  apiKey: process.env.ARCLIGHT_API_KEY,
  authorize: () => isSignedIn(),
});

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
