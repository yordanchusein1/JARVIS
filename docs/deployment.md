# Deployment

This guide runs Arclight on a Linux server (a VPS) with your own domain and HTTPS, so your whole team can use it from anywhere.

> [!NOTE]
> Arclight needs long-running processes (the worker) and a database, so it doesn't fit serverless platforms such as Vercel. A small VPS is the simplest and cheapest home. The public website in `apps/web` is different: it is static and deploys to Vercel happily ([instructions](../apps/web/README.md)).

## What you need

- A VPS with **2 GB of memory**, 1–2 vCPUs and 20 GB of disk, running Ubuntu 24.04 or Debian 12. Any provider works; one close to your users keeps things snappy.
- A domain where you can add DNS records, for example `arclight.youragency.com`.
- Your `.env` values from [Getting started](getting-started.md#5-configure-it).

## 1. Point your domain at the server

Add DNS **A** records with your server's IP address:

| Name                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `arclight.youragency.com`     | The dashboard                                               |
| `api.arclight.youragency.com` | The API. Only needed if your website or other tools call it |

## 2. Prepare the server

Connect with SSH, then install Docker with the Compose plugin by following [Docker's instructions for Ubuntu or Debian](https://docs.docker.com/engine/install/). Allow only SSH and web traffic through the firewall:

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## 3. Start Arclight

```sh
git clone https://github.com/yordanchusein1/arclight arclight
cd arclight
cp .env.example .env
nano .env   # fill in the values; POSTGRES_PASSWORD is required on a server
docker compose up -d --build
```

Then [connect the dashboard](getting-started.md#7-connect-the-dashboard) with an API key.

Docker Compose publishes the dashboard (`3000`) and the API (`8787`) on `127.0.0.1` only, so nothing is reachable from the internet yet. The database isn't published at all.

## 4. Add HTTPS with Caddy

[Caddy](https://caddyserver.com/) is a web server that gets and renews HTTPS certificates automatically. Install it with [the official instructions](https://caddyserver.com/docs/install), then replace `/etc/caddy/Caddyfile` with:

```caddy
arclight.youragency.com {
	reverse_proxy 127.0.0.1:3000
}

# Only if your website or tools call the API:
api.arclight.youragency.com {
	reverse_proxy 127.0.0.1:8787
}
```

Reload Caddy:

```sh
sudo systemctl reload caddy
```

Open `https://arclight.youragency.com` and sign in.

> Keep the dashboard behind Caddy rather than publishing port 3000 directly. Sign-in limits failed attempts per client address, and it relies on the address that Caddy passes on.

## 5. Back up the database

Everything Arclight knows lives in PostgreSQL. Create a daily backup:

```sh
mkdir -p ~/arclight-backups
crontab -e
```

Add this line (it keeps 14 days of backups):

```cron
0 2 * * * cd ~/arclight && docker compose exec -T postgres pg_dump -U arclight arclight | gzip > ~/arclight-backups/arclight-$(date +\%F).sql.gz && find ~/arclight-backups -name '*.sql.gz' -mtime +14 -delete
```

Copy the backups somewhere off the server too, for example with your provider's snapshot feature or `rclone` to cloud storage. A backup on the same server doesn't survive losing the server.

**Restoring** into a fresh installation:

```sh
docker compose up -d postgres
gunzip -c arclight-2026-09-24.sql.gz | docker compose exec -T postgres psql -U arclight arclight
docker compose up -d
```

## 6. Updating

```sh
cd ~/arclight
git pull
docker compose up -d --build
```

Database changes are applied automatically when the API and worker start. Read the [changelog](../CHANGELOG.md) before updating, and take a backup first.

## Keeping it healthy

| Task                       | Command                                              |
| -------------------------- | ---------------------------------------------------- |
| Check that everything runs | `docker compose ps`                                  |
| Follow the logs            | `docker compose logs -f --tail 100`                  |
| Check the API from outside | `curl https://api.arclight.youragency.com/v1/health` |
| Server security updates    | `sudo apt update && sudo apt upgrade`                |

## Security checklist

- [ ] `DASHBOARD_PASSWORD` is long and unique, and `SESSION_SECRET` is random.
- [ ] `POSTGRES_PASSWORD` is set to a random value.
- [ ] Only ports 22, 80 and 443 are open in the firewall.
- [ ] The Google API key is restricted to Places API (New) and PageSpeed Insights API.
- [ ] Backups run daily and are copied off the server.
- [ ] API keys are only stored on servers that need them. See [SECURITY.md](../SECURITY.md) for reporting problems.

## Deploying on Railway

Railway detects the monorepo and offers a service per package. Don't use those; Arclight needs three services:

1. **PostgreSQL**: + Add → Database → PostgreSQL.
2. **api**: + Add → GitHub Repo → your Arclight repo. Leave Root Directory empty and, under Settings → Config-as-code, set the path to `/deploy/railway/api.json` (builds the root `Dockerfile`, applies migrations before each deploy, starts the API). Generate a domain under Networking.
3. **worker**: the same repo again, with config path `/deploy/railway/worker.json`. It needs no domain.

Variables for both api and worker: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, and for the worker also `DEFAULT_COUNTRY_CODE` (and the Instagram variables, if used). See [configuration](configuration.md).

Create an API key for each client from the api service's shell: `tsx src/cli/create-api-key.ts <name>`. Your admin then uses the api domain as `ARCLIGHT_API_URL` and that key as `ARCLIGHT_API_KEY`.
