# Architecture

> This document describes Arclight as built for v0.1 (early access). The reasons behind major choices are in [DECISIONS.md](DECISIONS.md).

## Overview

Arclight is a **headless engine**: a standalone service with a versioned HTTP API. Every user interface, including Arclight's own dashboard, is a client of that API.

```
┌──────────────────────────── Arclight (this repository) ──────────────────────────┐
│                                                                                  │
│  apps/api  (Hono)  ──enqueue──►  pg-boss queue  ──►  apps/api worker process     │
│   /v1/* + OpenAPI                                    audit · score · draft       │
│        │                                                    │                    │
│        └──────────────►  PostgreSQL  ◄──────────────────────┘                    │
│                                                                                  │
│  packages/core    domain logic: discovery, audit, scoring, drafting, LLM          │
│  packages/sdk     typed API client (MIT)                                         │
│  apps/dashboard   Next.js built-in dashboard, which talks to the API via the SDK │
└──────────────────────────────────────────────────────────────────────────────────┘
          ▲ HTTP (/v1)                               ▲ HTTP (/v1), server-side API key
          │                                          │
  Built-in dashboard                       Any website's admin panel
                                           (Next.js, Laravel, WordPress, …)
```

## Repository layout

```
arclight/
├── apps/
│   ├── api/          # Hono HTTP server (/v1, OpenAPI) and worker entrypoint
│   ├── dashboard/    # Next.js built-in dashboard with single-admin sign-in
│   └── web/          # Public website (static Next.js)
├── packages/
│   ├── core/         # Framework-agnostic domain logic and database access
│   ├── sdk/          # Typed client for the /v1 API (MIT)
│   └── react/        # (v0.2) Embeddable React components (MIT)
├── docs/             # Documentation, decisions and the brand kit
├── docker-compose.yml   # postgres · api · worker · dashboard
└── LICENSE
```

- **`packages/core`** contains all business logic and depends on no HTTP framework. It can be tested in isolation, and it can be reused if the transport changes.
- **`apps/api`** is a thin HTTP layer over `core`. Validation schemas (zod) generate the OpenAPI spec. The same package has a second entrypoint that runs the background worker.
- **`apps/dashboard`** must not import `core` or touch the database. It uses `packages/sdk` only. This rule keeps the API complete enough for any external website. Sign-in uses a signed, expiring session cookie that is checked in `proxy.ts` and again before every API call.
- **`apps/web`** is the public landing page. It has no connection to the engine.

## Data sources

| Source                                                         | How it is used                                                                                                                                                                 | What is stored                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Google Places API (New)**                                    | Live text search from the dashboard, e.g. "dental clinic, Surabaya". Details such as rating are fetched live when shown.                                                       | **`place_id` only.** The Google Maps Platform Terms forbid copying and saving business names, addresses or reviews.     |
| **The business's own website**                                 | Page fetches (honouring `robots.txt`) plus the PageSpeed Insights API, which is free but needs an API key.                                                                     | Audit results, and the contact channels and social profile links that the business publishes there.                     |
| **Manual input**                                               | Pasted website URLs or a CSV upload.                                                                                                                                           | What the user provides.                                                                                                 |
| **Instagram Graph API: Business Discovery** _(v0.2, optional)_ | Public business or creator accounts found through links on the business's website. Requires the agency's own Instagram business account and a Meta app that has passed review. | Follower count, post count and the date of the latest post, used as capacity signals and refreshed rather than hoarded. |

**Not used:** scraping Google Maps, Instagram, Facebook, TikTok or LinkedIn, which is against their terms, and the Meta Ad Library API, which covers only political ads and ads delivered in the EU, so it is of little use for Indonesian businesses.

> This is our reading of the providers' terms, not legal advice. Anyone deploying Arclight is responsible for their own compliance.

## Lead pipeline

```
search/import ─► track (place_id or URL) ─► audit ─► score ─► draft ─► human sends ─► status
```

1. **Track.** The user selects results to track. Arclight stores the place ID, or the normalised website from a pasted URL or CSV. Websites on the do-not-contact list are refused.
2. **Audit** (background job). For a Google place, the website is looked up live; once Arclight has visited it, the website address (now first-party data) is saved. A place without a website gets a `no_website` need signal and an unknown capacity.
   - PageSpeed Insights (mobile): performance score and Core Web Vitals.
   - HTTPS, a mobile viewport, and signs of an outdated site (old copyright year, legacy libraries).
   - Contact, booking or enquiry forms, and click-to-chat links.
   - Published contact channels and social profile links.
   - Capacity signals on the site: number of branches or locations, team or doctor pages, a careers page.
3. **Score.** `need` and `capacity` each run from 0 to 100, and every contributing signal carries a human-readable piece of evidence (e.g. `"LCP 8.9 s on mobile"`). Weights are configurable. Users can rate a lead 👍 or 👎 to calibrate the weights over time.
4. **Draft.** The LLM writes WhatsApp and email variants grounded **only** in the recorded evidence and the agency profile (services, tone, sender name).
5. **Act.** The UI offers copy, `wa.me`, `mailto:` and open-profile links. The user sends the message and updates the status. The system sends nothing.

## Embedding Arclight in any website

```
Browser (staff) ──session──► Your website's backend ──API key (server-side only)──► Arclight /v1
```

1. Run Arclight as a separate service (Docker) next to your website.
2. Your backend authenticates your staff as usual, then calls Arclight using a server-side API key. The key must never reach the browser.
3. Your frontend renders your own UI, or `@arclight/react` components from v0.2 onwards. See [Embedding](embedding.md).

Integration options, in order of availability:

| Option                                             | For                                          | Available                                       |
| -------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| REST API + OpenAPI spec                            | Any language or framework                    | v0.1                                            |
| TypeScript SDK                                     | Node and Next.js backends                    | v0.1 (used by the dashboard), published in v0.2 |
| React components                                   | React and Next.js admin panels               | v0.2                                            |
| Framework-agnostic embed (web component or iframe) | WordPress, Laravel and other non-React sites | v0.3                                            |

The reference integration is the Vera & Co. admin panel (Next.js).

## Safety

- **No outbound sending** in the system. Every contact is made by a person.
- **SSRF protection:** website fetches block private, loopback and link-local addresses, limit redirects, and enforce timeouts and size limits.
- **Do-not-contact list**, applied everywhere a lead is shown.
- **Activity log** of every tracked lead, audit, draft, status change and do-not-contact entry.
- **Prompt injection:** content from prospects' websites reaches the model only as evidence sentences inside a data block, and drafts are checked for numbers the audit never measured.
- **Dashboard sign-in:** constant-time password comparison and a limit of five failed attempts per client address per 15 minutes.
- **Secrets** come only from environment variables. The API key is stored hashed.

## Technology choices

| Concern   | Choice                                                       |
| --------- | ------------------------------------------------------------ |
| Language  | TypeScript (strict)                                          |
| HTTP      | Hono + `@hono/zod-openapi`                                   |
| Database  | PostgreSQL + Drizzle ORM (pgvector later, for agency memory) |
| Jobs      | pg-boss                                                      |
| LLM       | Anthropic SDK behind a small provider interface              |
| Dashboard | Next.js                                                      |
| Tooling   | pnpm workspaces, Vitest, ESLint, Prettier, GitHub Actions    |
