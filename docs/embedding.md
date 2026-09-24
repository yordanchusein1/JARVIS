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

> [!NOTE]
> Drop-in React components (lead list, lead page, pipeline, chat) are planned for v0.2. Until then, build your own views on the API; the examples below show how little code that takes.

## Next.js (App Router)

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
