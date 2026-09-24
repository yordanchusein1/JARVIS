# Configuration

Arclight is configured with environment variables. With Docker Compose, put them in the `.env` file next to `docker-compose.yml`; Compose passes each one to the parts that need it. [`.env.example`](../.env.example) lists them all with comments.

## Required

| Variable             | Used by   | Description                                                                                                                                  |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DASHBOARD_PASSWORD` | Dashboard | Password for signing in. Without it, sign-in is disabled and the dashboard can't be used.                                                    |
| `SESSION_SECRET`     | Dashboard | At least 32 random characters used to sign session cookies. Changing it signs everyone out.                                                  |
| `ARCLIGHT_API_KEY`   | Dashboard | API key the dashboard uses to call the API. Create it with `create-api-key` ([getting started](getting-started.md#7-connect-the-dashboard)). |
| `POSTGRES_PASSWORD`  | Compose   | Database password. Letters and digits only. Read only when the database is first created.                                                    |

## Recommended

| Variable            | Used by     | Default         | Description                                                                                                                                                      |
| ------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`    | API, worker | not set         | Google Cloud key with **Places API (New)** and **PageSpeed Insights API** enabled. Without it, Google Maps search, live Google details and speed checks are off. |
| `ANTHROPIC_API_KEY` | API         | not set         | Anthropic key for writing drafts. Without it, drafting returns an error and everything else still works.                                                         |
| `ANTHROPIC_MODEL`   | API         | `claude-opus-5` | Claude model used for drafts.                                                                                                                                    |

## Optional

| Variable               | Used by     | Default               | Description                                                                        |
| ---------------------- | ----------- | --------------------- | ---------------------------------------------------------------------------------- |
| `AUDIT_CONCURRENCY`    | Worker      | `3`                   | Audits that run at the same time (1–20).                                           |
| `DEFAULT_COUNTRY_CODE` | Worker      | `62`                  | Calling code added to local phone numbers found on websites, e.g. 0812… → +62812…. |
| `PORT`                 | API         | `8787`                | Port the API listens on.                                                           |
| `ARCLIGHT_API_URL`     | Dashboard   | `http://api:8787`     | Where the dashboard reaches the API. Compose sets this for you.                    |
| `DATABASE_URL`         | API, worker | set by Compose        | PostgreSQL connection string. Only needed when running outside Docker.             |
| `SITE_URL`             | Website     | Vercel production URL | Absolute URL of the public website, used for social previews.                      |

## Applying changes

After editing `.env`, recreate the parts that use the variable, for example:

```sh
docker compose up -d api worker dashboard
```

## API keys

API keys authenticate every call to the API. They start with `arc_`, are shown once when created, and are stored only as a hash. Create one per client (the dashboard, your website, an automation):

```sh
docker compose exec api tsx src/cli/create-api-key.ts my-website
```

Keep API keys on servers. Never put one in a web page or a mobile app.
