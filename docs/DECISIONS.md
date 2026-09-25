# Decisions

This is a short record of the decisions that are expensive to reverse, with the reasoning behind each one. Add a new entry to change a decision; don't silently edit an old one.

---

### D1: Headless engine, embeddable in any website

_2026-09-24 · Accepted_

**Decision:** Arclight is a standalone service with a versioned HTTP API (`/v1`) and an OpenAPI spec. The built-in dashboard may use only the public API, through the SDK.

**Why:** The long-term goal is for any agency to plug Arclight into its own website, whatever it is built with. If the project's own UI depends on the public API, the API stays complete and the embedding path is tested every day.

### D2: TypeScript across the stack

_2026-09-24 · Accepted_

**Decision:** Use TypeScript for the API, worker, core logic, SDK and dashboard. Python may be added later as an optional sidecar service for a specific need, such as local speech-to-text.

**Why:** Arclight orchestrates work: it calls LLM and data APIs, runs background jobs, stores data and serves a UI. Python's biggest strengths (model training, data science, local ML) aren't needed for this, because the heavy AI runs at the model provider. TypeScript offers one language from the database to the embeddable components, shared types between API and SDK, first-class Anthropic and MCP SDKs, native Lighthouse tooling, and the same stack as the first integration target (Next.js). Because the architecture is headless, adding a Python sidecar later doesn't require a rewrite.

**Revisit when:** a core feature needs a library with no workable TypeScript equivalent.

### D3: Official data sources only

_2026-09-24 · Accepted_

**Decision:** Use the Google Places API for live search only and store just `place_id`. Business data comes from the business's own website, manual input and official social APIs (Instagram Business Discovery). Don't scrape Google Maps or social networks.

**Why:** The Google Maps Platform Terms (§3.2.3) forbid copying and saving business names, addresses or reviews, and social networks forbid scraping. Building a terms violation into an open-source core would put every user's API keys and the project's reputation at risk.

### D4: No automated sending in v0.1

_2026-09-24 · Accepted_

**Decision:** Arclight prepares messages, and a person sends them through copy, `wa.me`, `mailto:` or a link to the profile.

**Why:** Automated cold email needs a separate domain, warm-up, SPF/DKIM/DMARC and bounce handling. Getting it wrong damages the agency's main domain. Bulk WhatsApp gets numbers banned. Indonesian mid-market businesses respond mainly on WhatsApp and Instagram, and a small agency needs quality, not volume.

**Revisit when:** v0.3 or later, and then only as an opt-in with deliverability safeguards.

### D5: Concrete first, plugins later

_2026-09-24 · Accepted_

**Decision:** Build the web-agency lead pipeline as concrete, modular code. Extract plugin interfaces (sources, qualifiers, channels) in v0.3, when a second agency type is implemented.

**Why:** Interfaces designed before two real implementations exist are usually wrong, and they slow down the first version.

### D6: AGPL-3.0 core, MIT client libraries, CLA for contributors

_2026-09-24 · Accepted_

**Decision:** The engine and dashboard use AGPL-3.0. `packages/sdk` and `packages/react` use MIT. External contributions require a Contributor License Agreement.

**Why:** AGPL stops closed SaaS forks of the engine. MIT client libraries let agencies embed Arclight in closed-source admin panels without licensing concerns. The CLA keeps the option of a future commercial edition under a separate brand, which would be impossible to relicense without contributors' permission.

### D7: Start with established B2C local businesses

_2026-09-24 · Accepted_

**Decision:** The default targets are established mid-market businesses with a physical presence, such as clinics, dental practices, private schools, hotels and venues.

**Why:** For these businesses, public signals (website, branches, social activity, Google rating) are reliable. Micro-businesses rarely afford an agency. B2B segments need data sources Arclight doesn't have yet.

### D8: Vera & Co. is the first user

_2026-09-24 · Accepted_

**Decision:** Each milestone must be used by Vera & Co. before the next one starts. The project isn't promoted publicly until Vera & Co. has used v0.1 for at least a month.

**Why:** Open-source projects are usually abandoned when they deliver no value to their author for too long. Using it ourselves keeps the scope honest.

### D9: Capacity for businesses without a website comes from Instagram, not Google

_2026-09-24 · Accepted_

**Decision:** For businesses found on Google Maps without a website, capacity stays "unknown" until Instagram Business Discovery signals (official Meta API) are added in v0.2. Google review counts are shown live to the user but are never stored or turned into a stored signal.

**Why:** Storing a score derived from Google review counts is a grey area under the Google Maps Platform Terms (§3.2.3), and D3 keeps Arclight clear of them. Meanwhile the user sees ratings live when picking businesses on the Find page, so selection already filters for established businesses.

### D10: A vertical tool that any agent can use, not a general agent

_2026-09-24 · Accepted_

**Decision:** Arclight stays a focused lead generation tool for agencies. It does not try to become a general-purpose agent. Instead, it is usable three ways: its dashboard, embedded in an agency's website through the API, and as tools for AI agents through an MCP server.

**Why:** General agents such as Hermes Agent are backed by large teams and communities, and competing with them would stall a small project. Arclight's value is what a general agent does not do reliably: consistent evidence-based scoring, a lead pipeline, and built-in compliance (Google terms, do-not-contact, no automated sending). Offering an MCP server lets Arclight benefit from those agents' adoption instead.

### D11: The public name is Arclight

_2026-09-24 · Accepted_

**Decision:** The project, formerly developed under the codename JARVIS, is called Arclight. Packages are `@arclight/*` and API keys start with `arc_`. The GitHub repository was renamed to `arclight`; GitHub redirects old links.

**Why:** "JARVIS" is a Marvel trademark and impossible to search for. Arclight keeps the spirit of an always-on assistant (the light of an arc reactor) without borrowing anyone's brand.

### D12: Arclight acts on its own up to the draft, and no further

_2026-09-25 · Accepted_

**Decision:** Arclight may work without being asked: hunts search, track, audit and draft on a schedule, and the daily briefing reports the results. It never contacts a prospect on its own; a person reviews and sends every message (D4). Each hunt has a daily cap on new leads, and automatic drafting is opt-in per hunt with a priority threshold.

**Why:** Finding and researching leads is the slow part of outreach, and it is safe to automate because mistakes stay inside the agency. Contacting a business is not: a wrong or badly timed message costs the agency's reputation and can break anti-spam rules. The caps keep the cost of Google and Claude calls predictable and the daily list short enough to review properly.
