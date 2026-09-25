# Contributing to Arclight

Thanks for your interest! Arclight is in early access, so bug reports, ideas and feedback from real agencies are the most valuable contributions right now. [Open an issue](https://github.com/yordanchusein1/arclight/issues) any time.

## Ground rules

Some choices are deliberate and not up for change in a pull request; [docs/DECISIONS.md](docs/DECISIONS.md) explains why. In particular:

- **No automated sending.** Arclight drafts; people send.
- **No terms-of-service violations.** No scraping of Google Maps, social networks or other services. Use official APIs, and store nothing from Google Maps except place IDs.
- **Evidence only.** Drafts may cite only what the audit measured.

To challenge a decision, open an issue first.

## Development setup

Requirements: Node.js 22.12+, pnpm 10 and PostgreSQL 16 (or Docker to run one).

```sh
pnpm install
cp .env.example .env               # set DATABASE_URL, DASHBOARD_PASSWORD, SESSION_SECRET
export $(grep -v '^#' .env | xargs)
pnpm db:migrate
pnpm api-key:create dashboard      # put the key in .env as ARCLIGHT_API_KEY, then export again
pnpm dev:api                       # http://localhost:8787/v1
pnpm dev:worker                    # audits
pnpm dev:dashboard                 # http://localhost:3000
pnpm dev:web                       # the public website, http://localhost:3100
```

A throwaway database for development and tests:

```sh
docker run -d --name arclight-db -p 5432:5432 \
  -e POSTGRES_USER=arclight -e POSTGRES_PASSWORD=arclight -e POSTGRES_DB=arclight postgres:16-alpine
```

## Project layout

| Path             | What it is                                                            |
| ---------------- | --------------------------------------------------------------------- |
| `packages/core`  | Domain logic: database, audits, scoring, drafting. No HTTP framework. |
| `apps/api`       | HTTP API (Hono) and the worker entrypoint                             |
| `packages/sdk`   | Typed API client generated from the OpenAPI document (MIT)            |
| `apps/dashboard` | Next.js dashboard. Uses only the SDK, never `core` or the database.   |
| `apps/web`       | Public website (static Next.js)                                       |
| `apps/mcp`       | MCP server for AI agents (MIT). Uses only the SDK.                    |
| `packages/react` | Embeddable React components and server handler (MIT)                  |
| `docs`           | Documentation, decisions, roadmap and the brand kit                   |

## Checks

Run these before opening a pull request; CI runs the same.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
DATABASE_URL=postgres://…/arclight_test pnpm test   # use a disposable database: tests empty it
```

When you change:

- **the database schema** (`packages/core/src/db/schema.ts`): run `pnpm db:generate` and commit the migration.
- **the API**: run `pnpm sdk:generate` and commit `packages/sdk/openapi.json` and `schema.d.ts`.
- **behaviour or configuration**: update the documentation in `docs/`.

## Licensing and the CLA

The engine, API, dashboard and website are AGPL-3.0; `packages/sdk`, `packages/react` and `apps/mcp` are MIT. Your contributions are licensed the same way.

Code contributions will also require signing a Contributor License Agreement, which keeps the option of a commercial edition open ([decision D6](docs/DECISIONS.md#d6-agpl-30-core-mit-client-libraries-cla-for-contributors)). The CLA process will be in place before the first external pull request is merged; you'll be asked to sign it on your pull request.

## Code of conduct

Everyone taking part in Arclight follows the [Code of Conduct](CODE_OF_CONDUCT.md).
