# Roadmap

Each version must be usable on its own and must be used by Vera & Co. before the next one starts (see [D8](DECISIONS.md#d8-vera--co-is-the-first-user)).

## v0.1: Lead Hunter MVP

**Goal:** go from *"find me prospects"* to *well-researched messages that a person sends*, in the first 2–3 weeks of development.

**Foundation**
- [ ] pnpm monorepo: `apps/api`, `apps/dashboard`, `packages/core`, `packages/sdk`
- [ ] TypeScript strict, ESLint, Prettier, Vitest, GitHub Actions CI
- [ ] Docker Compose: postgres, api, worker, dashboard
- [ ] Database schema: tracked businesses, audits, signals and evidence, scores, drafts, pipeline status, activity log, do-not-contact list
- [ ] `/v1` API with an OpenAPI spec and API-key auth; the dashboard uses the SDK only

**Pipeline**
- [ ] Find: live Google Places text search (store `place_id` only), pasted URLs, CSV import
- [ ] Audit: PageSpeed Insights (mobile), HTTPS, viewport, outdated-site signals, contact or booking form, published contacts and social links; with SSRF protection and `robots.txt` handling
- [ ] Score: `need` and `capacity` with per-signal evidence, configurable weights, and 👍/👎 feedback
- [ ] Agency profile: name, services, tone, sender name
- [ ] Draft: WhatsApp and email variants grounded only in the recorded evidence (Claude)
- [ ] Act: copy, `wa.me`, `mailto:`, open-profile buttons; manual status (new → contacted → replied → meeting → won/lost)

**Dashboard**
- [ ] Sign-in (single admin user)
- [ ] Search/import, lead list sorted by priority, lead detail with evidence and drafts, pipeline view, settings

### Success criteria (after 4 weeks of use by Vera & Co.)

*Proposed. The project owner should confirm these numbers.*

- At least 50 qualified leads contacted
- At least 5 replies
- At least 1 sales meeting booked
- Researching and drafting one lead takes under 2 minutes of human time

If the targets are missed, fix the qualification and messaging before building v0.2.

## v0.2: Embed in any website

**Goal:** JARVIS runs inside the Vera & Co. admin panel (Next.js).

- [ ] Publish the SDK (MIT)
- [ ] `packages/react` (MIT): lead list, lead detail, pipeline, and chat components
- [ ] Integration guide, with the Vera & Co. admin as the reference Next.js integration
- [ ] Streaming chat endpoint for talking to JARVIS in natural language
- [ ] Instagram Business Discovery signals (optional)
- [ ] Follow-up reminders (reminders only, never auto-sent) and an in-app daily briefing

## v0.3: Open to other agencies

**Goal:** agencies other than web agencies can use JARVIS productively.

- [ ] Extract plugin interfaces (sources, qualifiers, channels) and document how to write plugins
- [ ] Qualifiers for marketing and SEO agencies
- [ ] Framework-agnostic embed (web component or iframe) for WordPress, Laravel and other sites
- [ ] Multi-user with roles
- [ ] Optional automated email with deliverability safeguards (separate sending domain, SPF/DKIM checks, rate limits, unsubscribe)

## v0.4+: Chief of Staff

- [ ] Agency memory: services, portfolio, pricing and SOPs (pgvector)
- [ ] Proposal and report drafting
- [ ] More interfaces: WhatsApp Cloud API for internal commands, Telegram, Slack
- [ ] Voice mode (possibly a Python sidecar, see [D2](DECISIONS.md#d2-typescript-across-the-stack))
- [ ] CRM sync
- [ ] Public name and branding

## Working agreements

- Ship something Vera & Co. can use every 1–2 weeks.
- Keep the scope of each version as small as possible, and put new ideas in the backlog, not the current version.
- Don't promote the project publicly until v0.1 has been in real use for a month.

## Open decisions

- Public project name, needed before any package is published
- CLA tooling and text, needed before the first external contribution is merged
