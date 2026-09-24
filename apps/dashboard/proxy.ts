import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from './lib/session';

// Optimistic check that keeps signed-out visitors on the sign-in page. Every server-side call to
// the Arclight API checks the session again (lib/arclight.ts), so this is not the only line of defence.
export async function proxy(request: NextRequest) {
  const signedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    sessionSecret(),
  );
  if (!signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the sign-in page and static assets.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
