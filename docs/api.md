# API

Everything the dashboard does goes through Arclight's HTTP API, so everything is available to your own code too.

- **Base URL:** `http://<your-server>:8787/v1`
- **Format:** JSON requests and responses
- **Specification:** OpenAPI 3.1, served by your instance at `/v1/openapi.json` (also in [`packages/sdk/openapi.json`](../packages/sdk/openapi.json)). Import it into Postman, Insomnia or any OpenAPI tool.

## Authentication

Send an API key as a bearer token:

```http
Authorization: Bearer arc_…
```

Create keys with `create-api-key` (see [Configuration](configuration.md#api-keys)). Only `/v1/health` and `/v1/openapi.json` work without a key.

> [!WARNING]
> API keys give full access to your leads. Call the API from your server, never from a browser. The API deliberately doesn't enable CORS.

## Errors

Errors use one shape:

```json
{ "error": { "code": "not_found", "message": "Business not found" } }
```

| Status | `code`                        | Meaning                                                                                                |
| -----: | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
|    400 | `invalid_request`             | The request failed validation; `details` lists the problems                                            |
|    401 | `unauthorized`                | Missing or invalid API key                                                                             |
|    404 | `not_found`                   | No such resource                                                                                       |
|    409 | `not_ready`                   | Drafting isn't possible yet: incomplete agency profile, unfinished audit, or a do-not-contact business |
|    502 | `model_error`, `places_error` | Claude or Google failed; the server log has details                                                    |
|    503 | `not_configured`              | The feature needs `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY`                                              |

## Endpoints

### Businesses (leads)

| Method  | Path                      | Description                                                                      |
| ------- | ------------------------- | -------------------------------------------------------------------------------- |
| `GET`   | `/businesses`             | List leads, highest priority first. Query: `limit` (1–100, default 50), `offset` |
| `POST`  | `/businesses`             | Track websites: `{ "websites": ["klinik.co.id"], "source": "url" }` (max 100)    |
| `POST`  | `/businesses/import`      | Track the websites in a CSV: `{ "csv": "…" }` (max 1,000 websites)               |
| `POST`  | `/businesses/places`      | Track Google places by ID: `{ "placeIds": ["ChIJ…"] }` (max 20)                  |
| `GET`   | `/businesses/{id}`        | One lead with its latest audit, evidence, contacts and drafts                    |
| `PATCH` | `/businesses/{id}`        | Update `status` and/or `feedback` (`"good"`, `"bad"` or `null`)                  |
| `POST`  | `/businesses/{id}/audits` | Queue a new audit (returns `202`)                                                |
| `POST`  | `/businesses/{id}/drafts` | Write WhatsApp and email drafts (returns `201`)                                  |
| `GET`   | `/businesses/{id}/place`  | Live Google details of a business added from Google Maps (never stored)          |

New businesses are audited automatically. Audits run in the background; poll `GET /businesses/{id}` until `latestAudit.status` is `succeeded` or `failed`.

### Prospect search

| Method | Path             | Description                                                                                                     |
| ------ | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/places/search` | Search Google Maps: `?q=dental clinic Surabaya`. Results are live and include `businessId` when already tracked |

### Hunts

A hunt is a saved Google Maps search that the worker runs every day at `runHour` in the agency's time zone ([user guide](user-guide.md#hunts-finding-leads-on-its-own)).

| Method   | Path               | Description                                                                                 |
| -------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `GET`    | `/hunts`           | All hunts with `lastRun`, `nextRunAt` (`null` while paused) and the number of `leads` found |
| `POST`   | `/hunts`           | Create one: `{ "query": "klinik gigi Surabaya" }` plus any settings below (returns `201`)   |
| `GET`    | `/hunts/{id}`      | One hunt with its last 10 `runs`                                                            |
| `PATCH`  | `/hunts/{id}`      | Change settings; `{ "active": false }` pauses it                                            |
| `DELETE` | `/hunts/{id}`      | Delete the hunt and its runs. Leads it found stay, with `huntId: null`.                     |
| `POST`   | `/hunts/{id}/runs` | Run it now and wait for the result (returns `201` with the run)                             |

Settings and their defaults: `runHour` (0–23, `7`), `maxNewPerRun` (1–50, `10`), `minReviews` (`0`), `includeNoWebsite` (`true`), `autoDraft` (`false`), `autoDraftMinPriority` (0–100, `50`), `active` (`true`).

A run reports `found` (places Google returned), `alreadyTracked`, `excluded` (by filters or the do-not-contact list) and `tracked` (new leads). A run that couldn't search, for example because Google refused the key, is still returned, with `"status": "failed"` and an `error`. Leads found by a hunt carry its `huntId`.

### Daily briefing

| Method | Path        | Description                                                                               |
| ------ | ----------- | ----------------------------------------------------------------------------------------- |
| `GET`  | `/briefing` | What happened since `?since=` (ISO 8601; default: the last 24 hours) and what needs doing |

The response has counts for the period (`newLeads`, `audited`, `auditsFailed`, `draftsWritten`), the best `topNewLeads`, the `readyToSend` leads (new, with drafts, best first) and the `followUps` that are due (contacted longer ago than the agency's `followUpDays`, oldest first), each with a total, plus the period's `huntRuns` and the number of leads in each `pipeline` stage.

### Agency

| Method  | Path              | Description                                                                                                   |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/agency-profile` | Agency name, sender name, services, tone, language, `timezone` (IANA, e.g. `Asia/Jakarta`) and `followUpDays` |
| `PATCH` | `/agency-profile` | Update any of those fields                                                                                    |

### Do not contact

| Method   | Path                   | Description                                                                   |
| -------- | ---------------------- | ----------------------------------------------------------------------------- |
| `GET`    | `/do-not-contact`      | The list                                                                      |
| `POST`   | `/do-not-contact`      | Add `{ "kind": "domain" \| "email" \| "phone", "value": "…", "reason": "…" }` |
| `DELETE` | `/do-not-contact/{id}` | Remove an entry                                                               |

### Scoring

| Method | Path               | Description                                                                     |
| ------ | ------------------ | ------------------------------------------------------------------------------- |
| `GET`  | `/scoring/signals` | Every signal seen, its default and current points, and 👍/👎 counts             |
| `PUT`  | `/scoring/weights` | Replace signal points: `{ "weights": { "no_https": 10 } }`; rescores everything |

### System

| Method | Path            | Description          |
| ------ | --------------- | -------------------- |
| `GET`  | `/health`       | `{ "status": "ok" }` |
| `GET`  | `/openapi.json` | The OpenAPI document |

## Examples

Track two websites:

```sh
curl -X POST http://localhost:8787/v1/businesses \
  -H "Authorization: Bearer $ARCLIGHT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"websites": ["klinik-contoh.co.id", "https://www.sekolah-contoh.sch.id"]}'
```

Read a lead once its audit has finished (response shortened):

```sh
curl http://localhost:8787/v1/businesses/<id> \
  -H "Authorization: Bearer $ARCLIGHT_API_KEY"
```

```json
{
  "id": "0b6f…",
  "websiteUrl": "https://klinik-contoh.co.id/",
  "displayName": "Klinik Contoh",
  "status": "new",
  "priority": 68,
  "latestAudit": { "status": "succeeded", "needScore": 65, "capacityScore": 70, "notes": [] },
  "signals": [
    {
      "axis": "need",
      "key": "no_https",
      "points": 25,
      "evidence": "The website does not use HTTPS, so browsers label it \"Not secure\"."
    }
  ],
  "contacts": [
    {
      "kind": "email",
      "value": "info@klinik-contoh.co.id",
      "sourceUrl": "https://klinik-contoh.co.id/"
    }
  ],
  "drafts": [],
  "doNotContact": false
}
```

Write drafts:

```sh
curl -X POST http://localhost:8787/v1/businesses/<id>/drafts \
  -H "Authorization: Bearer $ARCLIGHT_API_KEY"
```

Hunt for dental clinics every morning at 6, writing drafts for strong leads:

```sh
curl -X POST http://localhost:8787/v1/hunts \
  -H "Authorization: Bearer $ARCLIGHT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "klinik gigi Surabaya", "runHour": 6, "minReviews": 20, "autoDraft": true}'
```

Show the briefing on your own admin page (response shortened):

```sh
curl http://localhost:8787/v1/briefing -H "Authorization: Bearer $ARCLIGHT_API_KEY"
```

```json
{
  "since": "2026-09-24T03:00:00.000Z",
  "until": "2026-09-25T03:00:00.000Z",
  "newLeads": 5,
  "audited": 5,
  "auditsFailed": 0,
  "draftsWritten": 1,
  "readyToSend": [{ "id": "0b6f…", "displayName": "Klinik Gigi Senyum Sehat", "priority": 87 }],
  "readyToSendTotal": 1,
  "followUps": [
    {
      "business": { "displayName": "Hotel Arjuna Batu" },
      "contactedAt": "2026-09-21T03:00:00.000Z"
    }
  ],
  "followUpsTotal": 1,
  "pipeline": { "new": 4, "contacted": 1, "replied": 0, "meeting": 0, "won": 0, "lost": 0 }
}
```

## TypeScript SDK

[`@arclight/sdk`](https://www.npmjs.com/package/@arclight/sdk) is a typed client generated from the OpenAPI document (MIT-licensed, source in [`packages/sdk`](../packages/sdk)):

```sh
npm install @arclight/sdk
```

```ts
import { createArclightClient } from '@arclight/sdk';

const arclight = createArclightClient({
  baseUrl: process.env.ARCLIGHT_API_URL!,
  apiKey: process.env.ARCLIGHT_API_KEY!,
});

const { data, error } = await arclight.GET('/businesses', { params: { query: { limit: 20 } } });
```

The SDK matches the API of the same release. If you run a different version of Arclight, generate types for your own instance instead: `npx openapi-typescript http://localhost:8787/v1/openapi.json -o arclight-schema.d.ts`, used with `openapi-fetch`.

See [Embedding](embedding.md) for a complete example inside a website.
