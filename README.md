# JARVIS

> An open-source AI Chief of Staff for agencies, built to plug into any website.

**Status:** 🧭 Planning, with no code yet. This repository currently holds the project's vision, architecture, decisions and roadmap.

JARVIS is a self-hosted AI assistant for the internal team of an agency: web, marketing, creative, SEO, branding and similar. It runs as its own service with an API, so an agency can use its built-in dashboard or embed it in its own admin panel.

Its first job is the one most agencies find hardest: **finding and reaching the right clients.**

> `JARVIS` is a working codename. The project will get its own public name before any packages are published or the project is promoted.

---

## The first feature: Lead Hunter

```
Find ──► Audit ──► Score ──► Draft ──► ✋ You send it ──► Track
```

1. **Find.** Search for businesses such as _"dental clinics in Surabaya"_ live through the Google Places API, or paste a list of websites.
2. **Audit.** JARVIS inspects each business's own website: speed, mobile experience, HTTPS, signs of an outdated site, whether it has a contact or booking form, and links to its social profiles.
3. **Score.** Each business gets two scores, each backed by evidence you can read:
   - **Capacity:** is this an established business that can afford an agency?
   - **Need:** is there a concrete gap the agency can fix?
4. **Draft.** It writes a personalised WhatsApp and email message that cites only facts it measured, e.g. _"Your homepage takes 8.9 s to load on mobile."_
5. **You send it.** One click copies the message or opens WhatsApp (`wa.me`), email (`mailto:`) or the business's Instagram profile. **JARVIS never sends anything on its own.**
6. **Track.** Move each lead through a simple pipeline: new → contacted → replied → meeting → won/lost.

## Design principles

- **Embeddable anywhere.** JARVIS is a headless engine with a versioned HTTP API and an OpenAPI spec. Its own dashboard uses the same public API that any other website would use.
- **Human in the loop.** A person approves and performs every outbound action.
- **Official data only.** It uses official APIs and the businesses' own websites. It does not scrape Google Maps or social networks.
- **Self-hosted.** Your lead data stays on your own server.
- **Model-agnostic.** Claude is the default LLM, behind a small interface.
- **Useful first, general later.** The first version is built concretely for a web agency. Extension points are extracted once a second agency type needs them.

## Planned stack

| Layer              | Choice                                       |
| ------------------ | -------------------------------------------- |
| Language           | TypeScript throughout                        |
| API & worker       | Hono · pg-boss (a Postgres-backed job queue) |
| Database           | PostgreSQL (Drizzle ORM)                     |
| Built-in dashboard | Next.js                                      |
| Client SDK         | Typed API client (MIT-licensed)              |
| LLM                | Claude by default                            |
| Deployment         | Docker Compose                               |

## Getting started

> Work in progress: v0.1 week 1. Businesses can be tracked by website address. Auditing comes next.

### With Docker

```sh
docker compose up -d --build
# Create an API key for the dashboard and start it with the key
JARVIS_API_KEY=$(docker compose exec -T api tsx src/cli/create-api-key.ts dashboard | tail -1)
echo "JARVIS_API_KEY=$JARVIS_API_KEY" >> .env
docker compose up -d dashboard
```

The dashboard runs at http://localhost:3000 and the API at http://localhost:8787/v1 (OpenAPI spec at `/v1/openapi.json`). The ports are bound to `127.0.0.1` because the dashboard has no sign-in yet.

### For development

Requirements: Node.js 22.12+, pnpm 10 and PostgreSQL 16.

```sh
pnpm install
cp .env.example .env              # then set DATABASE_URL
export $(grep -v '^#' .env | xargs)
pnpm api-key:create dashboard     # put the printed key in .env as JARVIS_API_KEY
pnpm dev:api                      # http://localhost:8787/v1
pnpm dev:dashboard                # http://localhost:3000 (needs JARVIS_API_URL and JARVIS_API_KEY)
```

| Command                                        | What it does                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm test`                                    | Runs all tests. `DATABASE_URL` must point to a disposable database. |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | Code quality checks                                                 |
| `pnpm db:generate`                             | Creates a migration after changing `packages/core/src/db/schema.ts` |
| `pnpm sdk:generate`                            | Regenerates the SDK after changing the API                          |

## Documentation

- [Vision](docs/VISION.md): why JARVIS exists and who it is for
- [Architecture](docs/ARCHITECTURE.md): components, data sources and how to embed JARVIS
- [Decisions](docs/DECISIONS.md): key decisions and the reasons behind them
- [Roadmap](docs/ROADMAP.md): what gets built, in what order, and how success is measured
- [Contributing](CONTRIBUTING.md)

## License

- The engine and dashboard are licensed under [AGPL-3.0](LICENSE). You may use, modify and self-host them freely. If you offer a modified version as a network service, you must publish your source.
- Client libraries (`packages/sdk` and the future `packages/react`) will be MIT-licensed, so you can use them in closed-source admin panels.
