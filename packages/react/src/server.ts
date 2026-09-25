/**
 * A request handler that lets browser components reach the Arclight API without ever seeing the
 * API key. Mount it on your server (e.g. a Next.js route handler) and decide in `authorize` who may
 * use it: usually your signed-in admins.
 *
 * ```ts
 * // app/api/arclight/[...path]/route.ts
 * const handler = createArclightHandler({
 *   apiUrl: process.env.ARCLIGHT_API_URL,
 *   apiKey: process.env.ARCLIGHT_API_KEY,
 *   basePath: '/api/arclight',
 *   authorize: async () => (await auth())?.user?.role === 'admin',
 * });
 * export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
 * ```
 */

export interface ArclightHandlerOptions {
  /**
   * Where the Arclight API runs, e.g. `http://localhost:8787`. Read on each request, so passing
   * `process.env.ARCLIGHT_API_URL` works even where it is unset at build time.
   */
  apiUrl: string | undefined;
  /** An Arclight API key, e.g. `process.env.ARCLIGHT_API_KEY`. It stays on the server. */
  apiKey: string | undefined;
  /**
   * Whether this request may use Arclight. Called for every request; return true only for people
   * allowed to see and change your leads.
   */
  authorize: (request: Request) => boolean | Promise<boolean>;
  /** The path the handler is mounted at. Default `/api/arclight`. */
  basePath?: string;
  /**
   * Origins (e.g. `https://admin.example.com`) allowed to send changes. By default, the request's
   * own host is allowed.
   */
  allowedOrigins?: string[];
  fetch?: typeof globalThis.fetch;
}

const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

const READ_METHODS = new Set(['GET', 'HEAD']);

/** Blocks cross-site requests that try to change data using the admin's cookies. */
function isSameOrigin(request: Request, allowedOrigins: string[] | undefined): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (allowedOrigins) return allowedOrigins.includes(origin);
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [
    new URL(request.url).host,
    request.headers.get('host'),
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
  ];
  return hosts.includes(host);
}

export function createArclightHandler({
  apiUrl,
  apiKey,
  authorize,
  basePath = '/api/arclight',
  allowedOrigins,
  fetch = globalThis.fetch,
}: ArclightHandlerOptions): (request: Request) => Promise<Response> {
  const base = basePath.replace(/\/+$/, '');

  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : null;
    // Only the versioned API is reachable, never other paths on the Arclight server.
    if (!path?.startsWith('/v1/')) return json(404, 'not_found', 'Route not found');

    if (!(await authorize(request))) {
      return json(401, 'unauthorized', 'Sign in to use Arclight');
    }
    if (!apiUrl || !apiKey) {
      return json(503, 'not_configured', 'Set the Arclight API URL and API key on the server');
    }
    if (!READ_METHODS.has(request.method) && !isSameOrigin(request, allowedOrigins)) {
      return json(403, 'forbidden', 'Cross-site request refused');
    }

    const headers = new Headers({ authorization: `Bearer ${apiKey}`, accept: 'application/json' });
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);

    let upstream: Response;
    try {
      upstream = await fetch(`${apiUrl.replace(/\/+$/, '')}${path}${url.search}`, {
        method: request.method,
        headers,
        body: READ_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
      });
    } catch {
      return json(502, 'unreachable', 'The Arclight API is not reachable');
    }

    // Pass the answer through, without upstream cookies or other headers.
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) responseHeaders.set('content-type', upstreamType);
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  };
}
