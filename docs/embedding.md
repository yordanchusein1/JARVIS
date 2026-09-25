# Embedding Arclight in your website

Arclight is built to live inside an agency's own admin panel. The built-in dashboard is just one client of the API; your website can be another.

```
Browser (your staff)
   │  your own sign-in and session
   ▼
Your website's server ──── API key (server-side only) ────► Arclight API  /v1
```

1. Run Arclight as its own service, next to your website ([Deployment](deployment.md)).
2. Create an API key for your website: `docker compose exec api tsx src/cli/create-api-key.ts my-website`.
3. Your server signs your staff in as usual, then calls the Arclight API with the key.
4. Your pages show the data however you like.

Your website's code stays private. The API key never reaches the browser, and Arclight can be upgraded independently.

There are two ways to build the pages: drop in Arclight's [React components](#react-components), or [build your own views](#build-your-own-views-nextjs) on the API.

## React components

[`@arclighthq/react`](../packages/react) (MIT) has ready-made components: the daily briefing with send buttons, the lead list, a lead's page with its evidence and drafts, and the pipeline. They run in the browser, so they reach Arclight through a small handler on your server that adds the API key after checking your own sign-in. The key never reaches the browser.

```
Browser: <Briefing />, <LeadList />, …
   │  fetch /api/arclight/v1/…   (your session cookie)
   ▼
Your server: createArclightHandler ── checks authorize(), adds the API key ──► Arclight API /v1
```

Install it in your admin project:

```sh
npm install @arclighthq/react
```

**1. Add the handler** as a catch-all route. `authorize` decides who may use Arclight; use your own admin check.

```ts
// app/api/arclight/[...path]/route.ts
import { createArclightHandler } from '@arclighthq/react/server';
import { auth } from '@/lib/auth'; // your own sign-in

const handler = createArclightHandler({
  apiUrl: process.env.ARCLIGHT_API_URL,
  apiKey: process.env.ARCLIGHT_API_KEY,
  basePath: '/api/arclight',
  authorize: async () => (await auth())?.user?.role === 'admin',
});

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
```

The handler only forwards `/v1` API calls, refuses anyone `authorize` rejects, and refuses changes (`POST`, `PATCH`, `PUT`, `DELETE`) that come from another website. If your admin runs on a different origin from the one the server sees, list it in `allowedOrigins`.

**2. Use the components** anywhere in your admin pages:

```tsx
// app/admin/page.tsx
import '@arclighthq/react/styles.css';
import { ArclightProvider, Briefing, LeadList, Pipeline } from '@arclighthq/react';

export default function AdminHome() {
  return (
    <ArclightProvider leadUrl="/admin/leads/:id">
      <Briefing title="Good morning" />
      <LeadList limit={20} />
      <Pipeline />
    </ArclightProvider>
  );
}
```

```tsx
// app/admin/leads/[id]/page.tsx
import '@arclighthq/react/styles.css';
import { ArclightProvider, LeadDetail } from '@arclighthq/react';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ArclightProvider leadUrl="/admin/leads/:id">
      <LeadDetail id={id} />
    </ArclightProvider>
  );
}
```

| Component           | Shows                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `<Briefing />`      | New leads, drafts ready to send with **Send on WhatsApp** and **Send by email** buttons, follow-ups due     |
| `<LeadList />`      | Leads by priority; refreshes itself while audits run                                                        |
| `<LeadDetail id />` | Scores, the evidence behind them, drafts with send buttons, status, **Write messages**, **Audit again**     |
| `<Pipeline />`      | Leads in columns by stage; changing a lead's stage saves it                                                 |
| `<Chat />`          | A conversation with Arclight that streams its answers; it can look up leads, search, draft and manage hunts |

`ArclightProvider` takes `basePath` (where the handler is mounted, default `/api/arclight`) and `leadUrl` (your lead page, with `:id`; without it, names aren't links).

**Styling.** `styles.css` is optional. Every colour is a CSS custom property on `.arc-root`, so you can match your admin's look:

```css
.arc-root {
  --arc-accent: #7c3aed;
  --arc-radius: 6px;
}
```

It follows the system's light or dark mode; pass `theme="light"` or `theme="dark"` to `ArclightProvider` to fix it. For full control, the presentational parts (`BriefingView`, `LeadListView`, `LeadDetailView`, `PipelineView`, `Score`, …) are exported too and take data as props.

## Reference integration: a Next.js admin on Vercel

[`examples/nextjs-admin`](../examples/nextjs-admin) is a complete, runnable admin with Arclight built in: the briefing, leads, a lead page, the pipeline and chat, in about 100 lines. This is how an agency admin such as Vera & Co.'s, a Next.js app on Vercel, uses Arclight:

```
Vercel: your admin (Next.js)                         Your server (VPS): Arclight
  pages with <Briefing />, <LeadList />, …             dashboard, API, worker, PostgreSQL
  app/api/arclight/[...path]  ── HTTPS + API key ──►   https://api.arclight.youragency.com/v1
```

1. **Run Arclight on a server** with HTTPS for the API ([Deployment](deployment.md), including the `api.` hostname). Vercel can't run Arclight's worker and database, and your admin must reach the API over the internet.
2. **Create an API key** for the admin: `docker compose exec api tsx src/cli/create-api-key.ts admin`.
3. **Add environment variables** in the Vercel project (**Settings → Environment Variables**): `ARCLIGHT_API_URL=https://api.arclight.youragency.com` and `ARCLIGHT_API_KEY=arc_…`. Don't prefix them with `NEXT_PUBLIC_`; they must stay on the server.
4. **Install** `@arclighthq/react` and copy the example's route (`app/api/arclight/[...path]/route.ts`) and the pages you want.
5. **Connect your sign-in:** in the route's `authorize`, call your admin's own session check. Only people who pass it can reach Arclight.
6. **Match your look** with `.arc-root { --arc-accent: …; }`, and set `theme="light"` or `"dark"` on `ArclightProvider` if your admin doesn't follow the system setting.
7. Deploy, open the admin, and check that the briefing loads. If it says "Sign in to use Arclight", `authorize` returned false; "The Arclight API is not reachable" means the URL or HTTPS is wrong.

The API key in Vercel gives full access to your leads, like the dashboard's. Create a separate key per app so you can replace one without touching the others.

## Build your own views (Next.js)

Store the connection in environment variables on your server:

```sh
ARCLIGHT_API_URL=https://api.arclight.example.com
ARCLIGHT_API_KEY=arc_…
```

Generate types for your instance and create a server-only client:

```sh
npm install openapi-fetch server-only
npx openapi-typescript "$ARCLIGHT_API_URL/v1/openapi.json" -o lib/arclight-schema.d.ts
```

```ts
// lib/arclight.ts
import 'server-only';
import createClient from 'openapi-fetch';
import type { paths } from './arclight-schema';

export const arclight = createClient<paths>({
  baseUrl: `${process.env.ARCLIGHT_API_URL}/v1`,
  headers: { Authorization: `Bearer ${process.env.ARCLIGHT_API_KEY}` },
});
```

Show the best leads on an admin page (a server component, so the key stays on the server):

```tsx
// app/admin/leads/page.tsx
import { arclight } from '@/lib/arclight';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  // Check your own admin session here before loading any data.
  const { data, error } = await arclight.GET('/businesses', { params: { query: { limit: 20 } } });
  if (error) return <p>Could not load leads: {error.error.message}</p>;

  return (
    <ul>
      {data.data.map((lead) => (
        <li key={lead.id}>
          {lead.displayName ?? lead.websiteUrl}: priority {lead.priority ?? '—'}
        </li>
      ))}
    </ul>
  );
}
```

Add prospects from a form with a server action:

```tsx
// app/admin/leads/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { arclight } from '@/lib/arclight';

export async function addProspects(form: FormData) {
  // Check your own admin session here too: server actions can be called directly.
  const websites = String(form.get('websites')).split(/\s+/).filter(Boolean);
  await arclight.POST('/businesses', { body: { websites } });
  revalidatePath('/admin/leads');
}
```

## Any other stack

The API is plain JSON over HTTP. For example, in PHP:

```php
$response = file_get_contents(getenv('ARCLIGHT_API_URL') . '/v1/businesses?limit=20', false,
  stream_context_create(['http' => [
    'header' => 'Authorization: Bearer ' . getenv('ARCLIGHT_API_KEY'),
  ]]));
$leads = json_decode($response, true)['data'];
```

The [API reference](api.md) lists every endpoint, and `/v1/openapi.json` can generate a client for most languages.

## Checklist

- [ ] The API key is only in server-side configuration, never in JavaScript sent to browsers.
- [ ] Every page and server action that calls Arclight checks your own admin session first.
- [ ] The Arclight API is reachable from your website's server over HTTPS (or a private network), not open to everyone without TLS.
