# Roadmap

Priorities can shift. Each version should be usable on its own, and v0.1 must already be useful for a real agency (Vera & Co.).

## v0.1: Lead Hunter MVP

Goal: go from *"find me prospects"* to *approved, personalised emails sent*.

- [ ] Project scaffolding: `core/` (FastAPI), `dashboard/` (Next.js), Docker Compose, CI
- [ ] Database schema: businesses, leads, scores, evidence, messages, approvals, audit log
- [ ] LLM provider interface with Claude as the default
- [ ] Plugin interfaces: `LeadSource`, `Qualifier`, `Enricher`, `Channel`
- [ ] LeadSource: Google Places API
- [ ] Qualifiers: website audit for *need* (speed, mobile, HTTPS, missing website) and business signals for *capacity* (review volume, branches)
- [ ] Enricher: contact information published on the business's website
- [ ] Personalised draft generation grounded in qualifier evidence
- [ ] Approval queue: review, edit, approve or reject
- [ ] Channel: email over SMTP, with opt-out handling
- [ ] Built-in dashboard: targets, lead table, lead detail, approval queue
- [ ] API-key auth and REST API documentation (OpenAPI)

## v0.2: Embed & follow-up

Goal: JARVIS runs inside Vera & Co.'s own admin panel.

- [ ] `@jarvis/react` component package (chat, lead table, approval queue)
- [ ] Streaming chat endpoint: control JARVIS in natural language
- [ ] Scheduled follow-ups and reply tracking
- [ ] Lightweight pipeline stages (new → contacted → replied → meeting → won/lost)
- [ ] Daily briefing (in-app)
- [ ] Integration guide: "Embed JARVIS in your admin panel"

## v0.3: Open to other agencies

Goal: agencies other than web agencies can use JARVIS productively.

- [ ] Plugin loading from configuration, plus plugin authoring docs
- [ ] Qualifiers for marketing agencies (ad activity, social engagement) and SEO agencies (search visibility, business profile completeness)
- [ ] Multi-user support with roles
- [ ] Agency profile: services, ideal customer profile and tone, used to steer qualification and drafting
- [ ] CSV import/export

## v0.4+: Chief of Staff

- [ ] Agency memory: knowledge base of services, portfolio, pricing and SOPs (RAG)
- [ ] Proposal and report drafting
- [ ] More channels and interfaces (e.g. WhatsApp Cloud API for internal commands, Telegram, Slack)
- [ ] Voice mode
- [ ] CRM sync
- [ ] Public name and branding

## Open decisions

- Public project name
- Job queue implementation (e.g. a Postgres-backed queue vs. Redis)
- Plugin distribution format (in-repo vs. installable packages)
