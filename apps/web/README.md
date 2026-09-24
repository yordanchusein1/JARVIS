# Arclight website

The public landing page, a static Next.js site.

```sh
pnpm dev:web                       # http://localhost:3100
pnpm --filter @arclight/web build  # writes the static site to apps/web/out
```

## Deploying to Vercel

1. Import the repository in Vercel and set **Root Directory** to `apps/web`. Vercel detects Next.js and pnpm.
2. Optionally set `SITE_URL` (for example `https://arclight.dev`) so social previews use absolute URLs. Without it, Vercel's production URL is used.

Any static host works as well: upload the contents of `apps/web/out`.

`public/og.png` is the social preview image (1200×630). Links to the repository and documentation live in `lib/site.ts`.
