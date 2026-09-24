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

### Agency

| Method  | Path              | Description                                           |
| ------- | ----------------- | ----------------------------------------------------- |
| `GET`   | `/agency-profile` | Agency name, sender name, services, tone and language |
| `PATCH` | `/agency-profile` | Update any of those fields                            |

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

## TypeScript SDK

[`packages/sdk`](../packages/sdk) is a typed client generated from the OpenAPI document (MIT-licensed). It isn't published to npm yet; until it is, copy the package or generate the same client for your instance:

```sh
npm install openapi-fetch
npx openapi-typescript http://localhost:8787/v1/openapi.json -o arclight-schema.d.ts
```

```ts
import createClient from 'openapi-fetch';
import type { paths } from './arclight-schema';

const arclight = createClient<paths>({
  baseUrl: `${process.env.ARCLIGHT_API_URL}/v1`,
  headers: { Authorization: `Bearer ${process.env.ARCLIGHT_API_KEY}` },
});

const { data, error } = await arclight.GET('/businesses', { params: { query: { limit: 20 } } });
```

See [Embedding](embedding.md) for a complete example inside a website.
