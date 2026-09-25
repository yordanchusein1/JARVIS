# Getting started

This guide takes you from nothing to your first drafted message. You don't need to be a developer, but you will copy a few commands into a terminal. Allow about 30 minutes, most of it creating API keys.

**What you'll need**

- A computer or server with at least 2 GB of free memory, running Windows, macOS or Linux
- A Google account (for Google Maps search and website speed checks)
- An Anthropic account (for writing messages with Claude)
- A payment method for both. Google has a monthly free allowance; Claude is billed per use. See [costs in the FAQ](faq.md#what-does-it-cost-to-run).

> [!TIP]
> To run Arclight for your whole team, follow this guide on a server and then read [Deployment](deployment.md) to add a domain and HTTPS.

## 1. Install Docker and Git

Arclight runs in [Docker](https://www.docker.com/), which packages everything it needs.

- **Windows or macOS:** install [Docker Desktop](https://docs.docker.com/desktop/) and start it.
- **Linux:** install [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin.

You also need [Git](https://git-scm.com/downloads) to download Arclight. On Windows, "Git Bash" (installed with Git) is a good terminal for the commands below.

Check that both work:

```sh
docker compose version
git --version
```

## 2. Create a Google Cloud API key

Arclight uses two Google APIs: **Places API (New)** to search Google Maps, and **PageSpeed Insights API** to measure how fast websites load on phones.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project, for example "Arclight".
2. **Attach a billing account** to the project (_Billing_ in the menu). The Places API requires one, even when your usage stays within Google's free monthly allowance. Check [Google Maps Platform pricing](https://mapsplatform.google.com/pricing/) for current prices.
3. Go to **APIs & Services → Library** and enable:
   - **Places API (New)**
   - **PageSpeed Insights API**
4. Go to **APIs & Services → Credentials → Create credentials → API key**. Copy the key.
5. Click the new key and, under **API restrictions**, choose **Restrict key** and select only the two APIs above. This limits the damage if the key ever leaks.

> Without a Google key Arclight still works with pasted websites and CSV imports, but Google Maps search and speed checks are turned off.

## 3. Create an Anthropic API key

1. Sign in to the [Claude Console](https://platform.claude.com/).
2. Add credits under **Billing**.
3. Open **API keys** in the settings and create a key named "Arclight". Copy it; it is shown only once.

> Without an Anthropic key Arclight still finds, audits and scores leads, but it can't write messages.

## 4. Download Arclight

```sh
git clone https://github.com/yordanchusein1/arclight arclight
cd arclight
```

## 5. Configure it

Copy the example settings file:

```sh
cp .env.example .env
```

Open `.env` in any text editor and fill in:

| Setting              | What to put                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`     | The key from step 2                                                                               |
| `ANTHROPIC_API_KEY`  | The key from step 3                                                                               |
| `DASHBOARD_PASSWORD` | The password you'll use to sign in. Make it long.                                                 |
| `SESSION_SECRET`     | At least 32 random characters (see below)                                                         |
| `POSTGRES_PASSWORD`  | A long random value, e.g. from `openssl rand -hex 24`. Set it before the first start (see below). |

To create a `SESSION_SECRET`, run `openssl rand -hex 32` (available in Git Bash, macOS and Linux) and paste the output. A 40-character password from a password manager also works.

> [!IMPORTANT]
> The database reads `POSTGRES_PASSWORD` only when it is created on the first start. Changing it afterwards breaks the connection until you change it inside the database too, so choose it now.

Leave `ARCLIGHT_API_KEY` empty for now. [Configuration](configuration.md) explains every setting.

## 6. Start Arclight

```sh
docker compose up -d --build
```

The first start takes a few minutes while Docker builds Arclight. When it finishes, check that all four parts are running:

```sh
docker compose ps
```

You should see `postgres`, `api`, `worker` and `dashboard` with the state `running`.

## 7. Connect the dashboard

The dashboard talks to the Arclight API with an API key, exactly as your own website would. Create one:

```sh
docker compose exec api tsx src/cli/create-api-key.ts dashboard
```

Copy the key it prints (it starts with `arc_`) into `.env`:

```sh
ARCLIGHT_API_KEY=arc_...
```

Restart the dashboard so it picks up the key:

```sh
docker compose up -d dashboard
```

## 8. Sign in

Open **http://localhost:3000** and sign in with your `DASHBOARD_PASSWORD`.

> [!NOTE]
> Use Chrome, Edge or Firefox for `localhost`. Some older Safari versions refuse the secure sign-in cookie on plain `http://`. On a server with HTTPS every browser works.

## 9. Your first leads

1. **Settings → Agency profile.** Enter your agency's name, your name and what you offer. Messages are written in your name and voice.
2. **Find.** Search for a kind of business and a place, for example `dental clinic Surabaya`. Tick the businesses that look established (the Google rating and review count help) and click **Track selected businesses**.
3. **Leads.** Arclight audits each business in the background; the list refreshes itself. Leads are sorted by priority.
4. Open a lead to see **why they need you** and **why they can afford you**, with the evidence for each point.
5. Click **Write messages**. Read the WhatsApp message and the email, fix anything you'd say differently, then use **Open WhatsApp** or **Open email** to send it yourself.
6. Move the lead to **Contacted** in the pipeline.
7. **Hunts.** When a search keeps giving good leads, click **Turn it into a hunt** on Find. Arclight then runs it every morning and the briefing at the top of **Leads** tells you what it found.

The [user guide](user-guide.md) explains every screen and score in detail.

## Everyday commands

| Task                         | Command                                    |
| ---------------------------- | ------------------------------------------ |
| Stop Arclight                | `docker compose stop`                      |
| Start it again               | `docker compose start`                     |
| See what it is doing         | `docker compose logs -f api worker`        |
| Update to the latest version | `git pull && docker compose up -d --build` |

Your data lives in a Docker volume and survives restarts and updates. `docker compose down -v` deletes it, so don't use `-v` unless you mean to.

## Troubleshooting

| You see                                     | What to do                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "Connect the dashboard" after signing in    | `ARCLIGHT_API_KEY` is empty or wrong. Repeat step 7.                                                                             |
| "Sign-in is not configured"                 | Set `DASHBOARD_PASSWORD` and a `SESSION_SECRET` of at least 32 characters, then `docker compose up -d dashboard`.                |
| "Speed checks were skipped" on a lead       | `GOOGLE_API_KEY` is missing, or the PageSpeed Insights API isn't enabled for it. Run `docker compose up -d worker` after fixing. |
| "Google Places search failed"               | Check that Places API (New) is enabled, billing is attached, and the key isn't restricted to other APIs.                         |
| "Set ANTHROPIC_API_KEY on the API server"   | Add the key to `.env`, then `docker compose up -d api`.                                                                          |
| "The language model could not write drafts" | Check your Anthropic key and credits. `docker compose logs api` shows the exact error.                                           |
| An audit says "Audit failed"                | Open the lead to read the reason. Websites that point to private network addresses are refused on purpose.                       |

Still stuck? [Open an issue](https://github.com/yordanchusein1/arclight/issues) with what you did and what you saw.
