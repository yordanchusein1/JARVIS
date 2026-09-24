# Changelog

Notable changes to Arclight. The project is in early access and doesn't publish numbered releases yet; entries are grouped by milestone.

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
