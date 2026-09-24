# Roadmap

Each version must be usable on its own and must be used by Vera & Co. before the next one starts (see [D8](DECISIONS.md#d8-vera--co-is-the-first-user)).

## v0.1: Lead Hunter MVP

**Goal:** go from _"find me prospects"_ to _well-researched messages that a person sends_.

**Time budget:** about 14 hours a week, for roughly 3–4 weeks (~50 hours). Each week ends with something Vera & Co. can use:

| Week | Deliverable                                                                 | Usable result                                  |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Foundation, URL import, website audit, lead list and detail with evidence   | Audit any prospect's website from a pasted URL |
| 2    | Scoring, agency profile, drafts, action buttons, manual status              | End-to-end outreach from pasted URLs           |
| 3    | Places live search, CSV import, do-not-contact list, 👍/👎 feedback         | Find new prospects without leaving JARVIS      |
| 4    | Buffer: hardening, deployment on the Vera & Co. server, fixes from real use | v0.1 in daily use                              |

**Foundation**

- [x] pnpm monorepo: `apps/api`, `apps/dashboard`, `packages/core`, `packages/sdk`
- [x] TypeScript strict, ESLint, Prettier, Vitest, GitHub Actions CI
- [x] Docker Compose: postgres, api, worker, dashboard
- [x] Worker process with a pg-boss job queue
- [x] Database schema: tracked businesses, audits, signals and evidence, scores, contact channels, pipeline status, activity log, do-not-contact list
- [x] Drafts table
- [x] `/v1` API with an OpenAPI spec and API-key auth; the dashboard uses the SDK only

**Pipeline**

- [x] Find: pasted URLs
- [x] Find: live Google Places text search (store `place_id` only), CSV import
- [x] Audit: PageSpeed Insights (mobile), HTTPS, viewport, outdated-site signals, contact or booking form, published contacts and social links; with SSRF protection and `robots.txt` handling
- [x] Score: `need` and `capacity` with per-signal evidence, and priority ranking
- [x] Score: configurable weights and 👍/👎 feedback
- [x] Agency profile: name, services, tone, sender name
- [x] Draft: WhatsApp and email variants grounded only in the recorded evidence (Claude), with a warning for numbers the audit did not measure
- [x] Act: copy, `wa.me`, `mailto:`, open-profile buttons; manual status (new → contacted → replied → meeting → won/lost)

**Dashboard**

- [ ] Sign-in (single admin user)
- [ ] Search/import, lead list sorted by priority, lead detail with evidence and drafts, pipeline view, settings

### Success criteria (after 4 weeks of use by Vera & Co.)

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
- [ ] **Autonomous hunts:** saved targets (e.g. "dental clinics, Surabaya, capacity ≥ 60") that JARVIS runs on a schedule. It finds, audits, scores and drafts new leads on its own, then reports the best ones in a daily briefing, ready for a person to send.
- [ ] Streaming chat endpoint for talking to JARVIS in natural language, e.g. _"find 20 dental clinics in Surabaya that need a new website"_
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

- **Capacity of businesses without a website.** JARVIS judges capacity from the website, so it is unknown for businesses found on Google Maps without one, which are often the best leads. Options: (a) Instagram Business Discovery signals (official API, planned for v0.2, needs Meta app review); (b) storing a coarse Google review-count bucket as a signal, which is a grey area under the Google Maps Platform Terms. Until decided, capacity shows as unknown and the Google rating is shown live on the lead page.

- Public project name, needed before any package is published
- CLA tooling and text, needed before the first external contribution is merged
