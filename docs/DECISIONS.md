# Decisions

This is a short record of the decisions that are expensive to reverse, with the reasoning behind each one. Add a new entry to change a decision; don't silently edit an old one.

---

### D1: Headless engine, embeddable in any website
*2026-09-24 · Accepted*

**Decision:** JARVIS is a standalone service with a versioned HTTP API (`/v1`) and an OpenAPI spec. The built-in dashboard may use only the public API, through the SDK.
**Why:** The long-term goal is for any agency to plug JARVIS into its own website, whatever it is built with. If the project's own UI depends on the public API, the API stays complete and the embedding path is tested every day.

### D2: TypeScript across the stack
*2026-09-24 · Accepted*

**Decision:** Use TypeScript for the API, worker, core logic, SDK and dashboard. Python may be added later as an optional sidecar service for a specific need, such as local speech-to-text.
**Why:** JARVIS orchestrates work: it calls LLM and data APIs, runs background jobs, stores data and serves a UI. Python's biggest strengths (model training, data science, local ML) aren't needed for this, because the heavy AI runs at the model provider. TypeScript offers one language from the database to the embeddable components, shared types between API and SDK, first-class Anthropic and MCP SDKs, native Lighthouse tooling, and the same stack as the first integration target (Next.js). Because the architecture is headless, adding a Python sidecar later doesn't require a rewrite.
**Revisit when:** a core feature needs a library with no workable TypeScript equivalent.

### D3: Official data sources only
*2026-09-24 · Accepted*

**Decision:** Use the Google Places API for live search only and store just `place_id`. Business data comes from the business's own website, manual input and official social APIs (Instagram Business Discovery). Don't scrape Google Maps or social networks.
**Why:** The Google Maps Platform Terms (§3.2.3) forbid copying and saving business names, addresses or reviews, and social networks forbid scraping. Building a terms violation into an open-source core would put every user's API keys and the project's reputation at risk.

### D4: No automated sending in v0.1
*2026-09-24 · Accepted*

**Decision:** JARVIS prepares messages, and a person sends them through copy, `wa.me`, `mailto:` or a link to the profile.
**Why:** Automated cold email needs a separate domain, warm-up, SPF/DKIM/DMARC and bounce handling. Getting it wrong damages the agency's main domain. Bulk WhatsApp gets numbers banned. Indonesian mid-market businesses respond mainly on WhatsApp and Instagram, and a small agency needs quality, not volume.
**Revisit when:** v0.3 or later, and then only as an opt-in with deliverability safeguards.

### D5: Concrete first, plugins later
*2026-09-24 · Accepted*

**Decision:** Build the web-agency lead pipeline as concrete, modular code. Extract plugin interfaces (sources, qualifiers, channels) in v0.3, when a second agency type is implemented.
**Why:** Interfaces designed before two real implementations exist are usually wrong, and they slow down the first version.

### D6: AGPL-3.0 core, MIT client libraries, CLA for contributors
*2026-09-24 · Accepted*

**Decision:** The engine and dashboard use AGPL-3.0. `packages/sdk` and `packages/react` use MIT. External contributions require a Contributor License Agreement.
**Why:** AGPL stops closed SaaS forks of the engine. MIT client libraries let agencies embed JARVIS in closed-source admin panels without licensing concerns. The CLA keeps the option of a future commercial edition under a separate brand, which would be impossible to relicense without contributors' permission.

### D7: Start with established B2C local businesses
*2026-09-24 · Accepted*

**Decision:** The default targets are established mid-market businesses with a physical presence, such as clinics, dental practices, private schools, hotels and venues.
**Why:** For these businesses, public signals (website, branches, social activity, Google rating) are reliable. Micro-businesses rarely afford an agency. B2B segments need data sources JARVIS doesn't have yet.

### D8: Vera & Co. is the first user
*2026-09-24 · Accepted*

**Decision:** Each milestone must be used by Vera & Co. before the next one starts. The project isn't promoted publicly until Vera & Co. has used v0.1 for at least a month.
**Why:** Open-source projects are usually abandoned when they deliver no value to their author for too long. Using it ourselves keeps the scope honest.
