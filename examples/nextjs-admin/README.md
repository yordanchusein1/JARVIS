# Example: Arclight inside a Next.js admin

A small agency admin panel (Next.js App Router) with Arclight built in, using [`@arclighthq/react`](https://www.npmjs.com/package/@arclighthq/react). It is the reference for adding Arclight to your own admin, such as the Vera & Co. admin. MIT-licensed: copy what you need.

| File                                  | What it does                                                                |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `app/api/arclight/[...path]/route.ts` | The only server code: checks the admin, adds the Arclight API key           |
| `app/admin/layout.tsx`                | Wraps admin pages in `<ArclightProvider>` and loads the styles              |
| `app/admin/page.tsx`                  | Daily briefing and leads                                                    |
| `app/admin/leads/[id]/page.tsx`       | A lead with evidence, drafts and send buttons                               |
| `app/admin/pipeline/page.tsx`         | Pipeline board                                                              |
| `app/admin/chat/page.tsx`             | Chat with Arclight                                                          |
| `lib/admin.ts`, `proxy.ts`            | Stand-in sign-in (one password). **Replace with your admin's own sign-in.** |
| `app/globals.css`                     | Your own styles; `.arc-root { --arc-accent: … }` matches Arclight to them   |

## Run it

With Arclight running (see [Getting started](../../docs/getting-started.md)) and an API key created for this app:

```sh
cp .env.example .env.local   # set ARCLIGHT_API_URL, ARCLIGHT_API_KEY and ADMIN_PASSWORD
pnpm install                 # from the repository root
pnpm --filter @arclight/example-nextjs-admin dev
```

Open http://localhost:3200/admin and sign in with any username and `ADMIN_PASSWORD`.

## In your own project

```sh
npm install @arclighthq/react
```

Copy the route and pages, replace `isAdmin` with your sign-in check, and remove `transpilePackages` from `next.config.ts` (it's only needed inside this repository). The full guide is [Embedding Arclight](../../docs/embedding.md#reference-integration-a-nextjs-admin-on-vercel).
