# Architecture

> Status: proposed. This document describes the target design and will change as the code is written.

## Overview

JARVIS is a **headless engine**: a standalone service with an HTTP API. User interfaces are clients of that API.

```
┌──────────────────────── JARVIS (this repository) ────────────────────────┐
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│   │  API server  │───►│  Job queue   │───►│  Workers                 │   │
│   │  (FastAPI)   │    │              │    │  discover · audit ·      │   │
│   └──────┬───────┘    └──────────────┘    │  enrich · draft · send   │   │
│          │                                └────────────┬─────────────┘   │
│          │           ┌─────────────────────────┐       │                 │
│          └──────────►│ PostgreSQL + pgvector   │◄──────┘                 │
│                      └─────────────────────────┘                         │
│                                                                          │
│   ┌──────────────────────┐   ┌──────────────────────────────┐            │
│   │ Built-in dashboard   │   │ @jarvis/react (UI components)│            │
│   │ (Next.js)            │   │ <JarvisChat/> <LeadTable/> … │            │
│   └──────────────────────┘   └──────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
            ▲ API                                  ▲ API (server-side key)
            │                                      │
   Agencies without their own admin      An agency's own admin panel
   use the built-in dashboard            (e.g. the Vera & Co. admin panel)
```

## Components

### API server (`core/`, Python · FastAPI)
- REST endpoints for leads, campaigns, approvals, settings and plugins.
- A streaming chat endpoint (Server-Sent Events) for talking to JARVIS in natural language.
- Authentication by API key (for server-to-server embedding) and user sessions (for the built-in dashboard).
- Owns the **agent loop**: the LLM decides which tools to call, and actions that need approval are paused until approved.

### Workers
Long-running work happens in the background so the API stays responsive:
- **Discover:** query lead sources for businesses matching a target.
- **Audit/qualify:** run qualifier plugins, e.g. a Lighthouse-style website audit.
- **Enrich:** collect public business contact channels.
- **Draft:** generate personalised outreach grounded in audit findings.
- **Send:** deliver approved messages, schedule follow-ups and record events.

### Database (PostgreSQL + pgvector)
One store for relational data (businesses, leads, scores, messages, approvals, audit logs) and for vectors (agency memory, used later).

### LLM provider layer
A small interface (`complete`, `stream`, `tool_call`) with Claude as the default implementation. Other providers and local models plug in behind it.

### Built-in dashboard (`dashboard/`, Next.js)
A ready-to-use UI for agencies that don't have an admin panel: lead review, the approval queue, the pipeline, settings and chat.

### UI kit (`packages/react`, `@jarvis/react`)
React components that agencies can drop into their own admin panels. They talk to the agency's backend, which proxies requests to JARVIS so the API key never reaches the browser.

## Plugin model

The core defines four extension points:

| Type | Responsibility | Examples |
|---|---|---|
| **LeadSource** | Find candidate businesses | Google Places API, CSV import |
| **Qualifier** | Score *capacity* and/or *need*, with evidence | Website audit (speed, mobile, HTTPS, age), review volume, ad activity |
| **Enricher** | Add public business contact channels | Contact info published on the business's website |
| **Channel** | Deliver approved messages | Email (SMTP), WhatsApp click-to-chat link (manual send) |

Every qualifier returns a score together with **human-readable evidence** (e.g. `"LCP 8.9s on mobile"`). The drafting step uses that evidence, so outreach is specific and verifiable.

A lead's priority combines two scores:

```
priority = f(capacity_score, need_score)   # best leads: high capacity AND high need
```

Weights and thresholds are configurable per agency.

## Embedding JARVIS in your own admin panel

This is how Vera & Co. uses JARVIS.

```
Browser (admin user)
   │  session cookie from YOUR admin
   ▼
Your admin backend ── JARVIS API key (server-side only) ──► JARVIS API
```

1. Run JARVIS as a separate service (Docker) next to your website.
2. Your admin backend authenticates your staff as usual, then calls the JARVIS API with a server-side API key.
3. Your admin frontend renders `@jarvis/react` components, or your own UI, against your backend.

Your website's code stays private, and JARVIS stays an independent, upgradable service.

## Safety and compliance

- **Approval gate:** `send`, `delete` and any action that costs money are queued as approval requests. They are never executed directly by the agent.
- **Audit log:** every agent action and approval is recorded.
- **Rate limiting and opt-out:** per-channel send limits. Unsubscribe and "do not contact" lists are enforced globally.
- **Data minimisation:** only public business contact data is stored, with retention settings for UU PDP and GDPR compliance.
- **Secrets:** all credentials come from environment variables and are never stored in plain text in the database.

## Repository layout (planned)

```
JARVIS/
├── core/               # Python engine: API, agent loop, workers, plugins
├── dashboard/          # Next.js built-in dashboard
├── packages/react/     # @jarvis/react embeddable components
├── docs/
├── docker-compose.yml
└── LICENSE
```
