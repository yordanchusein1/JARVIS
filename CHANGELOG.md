# Changelog

Notable changes to Arclight. The project is in early access and doesn't publish numbered releases yet; entries are grouped by milestone.

## v0.2 — in development

### Added

- **Hunts**: saved Google Maps searches that run every day at a chosen hour in the agency's time zone. Each run tracks up to a set number of new businesses, most-reviewed first, skipping ones that are already leads, on the do-not-contact list, below a minimum number of reviews or (optionally) without a website. Hunts can write drafts automatically for leads above a priority threshold; nothing is ever sent. API: `/v1/hunts`.
- **Daily briefing** at the top of the Leads page and at `GET /v1/briefing`: new leads, audits, drafts ready to send, follow-ups that are due and hunt results. Each lead that is ready to send has **Send on WhatsApp** and **Send by email** buttons that open the drafts, ready for you to send.
- Agency **time zone** and **follow-up days** in Settings.
- Google Maps searches can return up to 60 places (three pages) for hunts.
- **MCP server** (`apps/mcp`, MIT): AI agents such as Claude and Hermes Agent can use Arclight as a tool, with tools for the briefing, leads, Google Maps search, tracking, drafts, the pipeline, the do-not-contact list and hunts. It has no tool that sends messages; `get_lead` returns WhatsApp and email links with the drafts filled in for the person to send. See [docs/mcp.md](docs/mcp.md).
- **React components** (`packages/react`, MIT): `Briefing`, `LeadList`, `LeadDetail` and `Pipeline` for embedding Arclight in any React admin panel, and `createArclightHandler` for the server, which adds the API key after the host's own sign-in check and refuses cross-site changes. See [Embedding](docs/embedding.md#react-components).
- The SDK, React components and MCP server can be published to npm as `@arclighthq/sdk`, `@arclighthq/react` and `@arclighthq/mcp`. The MCP server then runs with `npx -y @arclighthq/mcp`. See [Publishing](docs/publishing.md).
- **Chat** (`POST /v1/chat`, the dashboard's Chat page and `<Chat />` in `@arclighthq/react`): ask Arclight in natural language. Claude answers with streaming, using Arclight's briefing, leads, Google Maps search, tracking, drafts, pipeline and hunts. It cannot send messages.

### Changed

- Pasting websites and importing CSV files moved from Leads to Find, next to Google Maps search. Find links a search to a new hunt.
- The worker uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` too, for automatic drafts.

### Fixed

- A phone number on the do-not-contact list now matches with or without the country code (`0812…` and `+62812…`).
- Settings forms keep what you typed when saving fails.

## v0.1 (early access) — unreleased

### Added

- **Find prospects** with Google Maps search (Places API, storing only place IDs), pasted websites or CSV import.
- **Website audits** in a background worker: mobile speed (PageSpeed Insights), HTTPS, mobile viewport, outdated copyright and libraries, contact and booking forms, WhatsApp links, free subdomains, and signs of an established business. Published contact channels are collected. Fetching refuses private network addresses and honours `robots.txt`.
- **Scores**: need, capacity and priority (their geometric mean), each backed by readable evidence.
- **Drafts** of a WhatsApp message and an email written by Claude from the evidence and the agency profile, with a warning when a draft mentions a number the audit didn't measure.
- **Pipeline** status, 👍/👎 lead feedback, per-signal insights and adjustable signal points.
- **Do-not-contact list** for domains, email addresses and phone numbers.
- **Dashboard** with single-admin sign-in.
- **HTTP API** (`/v1`) with an OpenAPI 3.1 document and API-key authentication, and a typed TypeScript SDK.
- **Docker Compose** setup, documentation and the public website.
