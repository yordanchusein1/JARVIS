import { createArclightHandler } from '@arclighthq/react/server';
import { isAdmin } from '@/lib/admin';

// The only server code Arclight needs: the browser components call this route, which adds the
// Arclight API key after checking that the visitor is an admin. The key never reaches the browser.
const handler = createArclightHandler({
  apiUrl: process.env.ARCLIGHT_API_URL,
  apiKey: process.env.ARCLIGHT_API_KEY,
  basePath: '/api/arclight',
  authorize: (request) => isAdmin(request.headers.get('authorization')),
});

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
