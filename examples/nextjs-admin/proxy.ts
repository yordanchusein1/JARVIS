import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from './lib/admin';

// Asks for the admin password on every admin page. Replace with your own sign-in.
export function proxy(request: NextRequest) {
  if (isAdmin(request.headers.get('authorization'))) return NextResponse.next();
  return new NextResponse('Sign in to the admin', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
  });
}

export const config = { matcher: ['/admin/:path*', '/api/arclight/:path*'] };
