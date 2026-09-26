# User guide

This guide explains every screen of the Arclight dashboard and how Arclight decides which leads are worth your time. If Arclight isn't installed yet, start with [Getting started](getting-started.md).

- [The idea in one minute](#the-idea-in-one-minute)
- [Agency profile](#agency-profile)
- [Adding prospects](#adding-prospects)
- [Hunts: finding leads on its own](#hunts-finding-leads-on-its-own)
- [The daily briefing](#the-daily-briefing)
- [Chat](#chat)
- [Audits: what Arclight checks](#audits-what-arclight-checks)
- [Scores and priority](#scores-and-priority)
- [Writing and sending messages](#writing-and-sending-messages)
- [Pipeline](#pipeline)
- [Tuning the scores](#tuning-the-scores)
- [Do-not-contact list](#do-not-contact-list)

## The idea in one minute

A good prospect has two things: a **need** you can see (a slow website, no HTTPS, no website at all) and the **capacity** to pay for your help (several branches, a team, a careers page). Arclight measures both from public information, ranks leads by the combination, and writes a first message that mentions only what it measured. You decide who gets a message, and you send it yourself.

## Agency profile

**Settings → Agency profile.** Fill this in before writing any messages.

| Field            | Used for                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| Agency name      | Introducing yourself and signing emails                                          |
| Your name        | The sender of every message                                                      |
| What you offer   | Choosing which findings matter. Be specific: "websites for clinics and schools". |
| Tone             | The voice of the messages, e.g. "friendly and professional" or "casual"          |
| Message language | Bahasa Indonesia or English                                                      |
| Time zone        | When hunts run and how the briefing's day is counted, e.g. `Asia/Jakarta`        |
| Follow up after  | Days without a reply before a contacted lead shows up as a follow-up             |

## Adding prospects

All three ways to add businesses by hand are on **Find**, and every new business is audited automatically. To have Arclight look for businesses every day on its own, use a [hunt](#hunts-finding-leads-on-its-own).

### Search Google Maps

**Find** searches Google Maps, for example `dental clinic Surabaya` or `private school Bandung`. The results show each business's Google rating, number of reviews and whether it lists a website. Use them to pick established businesses, then tick them and click **Track selected businesses**.

![Searching Google Maps for prospects](images/find.png)

Google's terms don't allow storing names, addresses or reviews from Google Maps, so Arclight stores only Google's place ID. On a lead's page you'll see the live Google details, fetched each time. In the leads list, such a business is called "Google Maps business" until Arclight has visited its website and read the name from it.

### Paste websites

Under **Or add websites yourself**, paste website addresses, one per line (`klinik.co.id` is enough). Addresses that can't be a public website, such as `localhost` or an IP address, are rejected, and websites already in Arclight aren't added twice.

### Import a CSV

Under **Or add websites yourself**, choose a CSV file and click **Import**. Arclight uses the column named `website`, `url` or `domain`; without one, it takes every cell that looks like a website address. Files exported from Excel with semicolons work too. Up to 1,000 websites per file.

## Hunts: finding leads on its own

A hunt is a Google Maps search that Arclight runs **every day at the hour you choose**, without you opening the dashboard. Each run it:

1. searches Google Maps for the hunt's query (up to 60 places, Google's limit),
2. skips businesses that are already leads, on the do-not-contact list, or left out by the hunt's filters,
3. starts tracking the most-reviewed of the rest, up to the hunt's limit, and audits them,
4. if you turned it on, writes drafts for the new leads that score high enough.

It never sends anything. New leads and drafts wait for you in the [daily briefing](#the-daily-briefing).

![Hunts with their schedule and last run](images/hunts.png)

**Create one** on **Hunts**, or search on **Find** and click **Turn it into a hunt**. The settings:

| Setting                              | What it does                                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps search                   | What to look for, as you would type it into Google Maps: `klinik gigi Surabaya`                                                                                                                                                          |
| Runs daily at                        | The hour, in the agency's time zone (**Settings**)                                                                                                                                                                                       |
| New leads per run                    | At most this many new leads each day (1–50). The most-reviewed businesses go first, so a small number keeps quality high and costs low.                                                                                                  |
| Minimum Google reviews               | Leaves out businesses with fewer reviews, usually ones too small to afford an agency. Review counts are checked live and never stored ([D9](DECISIONS.md#d9-capacity-for-businesses-without-a-website-comes-from-instagram-not-google)). |
| Include businesses without a website | Whether places with no website become leads. They are often the ones that need you most, but their capacity is unknown.                                                                                                                  |
| Write drafts automatically           | Writes messages for new leads whose priority reaches the number you set. Leads without a priority (no website) are never drafted automatically.                                                                                          |

**Run now** runs a hunt immediately, for example to try a new search. **Pause** stops the daily runs; **Resume** waits for the next scheduled hour instead of catching up on missed days. Deleting a hunt keeps the leads it found.

**Stop all automatic hunts** with the switch at the top of **Hunts** (or `automationPaused` in `PATCH /v1/agency-profile`, or `<AutomationToggle />` in an embedded admin). While it's off, no hunt runs on its own, so no Google searches, audits or drafts happen without you, which saves API and server costs. Searching, **Run now** and auditing still work when you ask for them. Turning it back on waits for each hunt's next hour instead of catching up. The worker process itself keeps running, idle; to stop paying for it entirely, stop the worker service at your host, and note that audits then wait until it runs again.

**When a hunt runs dry.** Google returns the same places for the same search, so after a while every result is already a lead. The hunt then says "Nothing new left in this search". Create hunts for neighbouring areas (`klinik gigi Sidoarjo`) or related business types (`klinik kecantikan Surabaya`) instead.

> [!NOTE]
> Hunts run in the **worker**. If the worker isn't running, or `GOOGLE_API_KEY` isn't set for it, runs are recorded as failed with the reason and shown on **Hunts** and in the briefing. Automatic drafts also need `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` on the worker ([Configuration](configuration.md)).

## The daily briefing

The top of **Leads** shows what happened in the last 24 hours and what needs you now:

![The daily briefing above the leads list](images/leads.png)

- **New leads**, how many of them hunts found, and how many audits finished or failed.
- **Ready to send**: new leads with drafts waiting, best first. **Send on WhatsApp** opens a chat with the business with the WhatsApp draft filled in; **Send by email** opens your email program with the email draft filled in. Read the message, then press send yourself. Open the lead first if you want to check its evidence or edit the draft.
- **Follow up**: leads you marked **Contacted** that have had no reply for the number of days set in **Settings** (3 by default). Once they reply, move them to **Replied** and they leave the list.
- A warning if a hunt failed, with the reason.

Your own website or an AI agent can fetch the same briefing from the API (`GET /v1/briefing`, see the [API reference](api.md#daily-briefing)).

## Chat

**Chat** lets you ask Arclight in your own words, in Bahasa Indonesia or English:

- _"Apa yang harus aku kerjakan hari ini?"_
- _"Cari klinik gigi di Sidoarjo dengan minimal 50 ulasan, lalu lacak 5 yang terbaik."_
- _"Tuliskan pesan untuk Klinik Gigi Senyum."_
- _"Buat hunt untuk sekolah swasta di Bandung setiap jam 6 pagi."_

It uses the same data and actions as the rest of the dashboard, and shows what it is doing while it works. It never sends a message: drafts it writes wait on the lead's page for you. Chat needs `ANTHROPIC_API_KEY`, and each question is a Claude request ([costs](faq.md#what-does-it-cost-to-run)). Conversations aren't saved; reloading the page starts a new one.

## Audits: what Arclight checks

For each business Arclight visits the homepage of its website, asks Google PageSpeed Insights how it performs on phones, and records **signals**. Every signal comes with a sentence of evidence, and only these sentences may be used in messages.

### Need: why they need you

| Signal               | Points | Evidence example                                                             |
| -------------------- | -----: | ---------------------------------------------------------------------------- |
| `no_website`         |     60 | The business has no website listed on its Google Maps profile.               |
| `unreachable`        |     40 | The website could not be loaded when Arclight visited it.                    |
| `http_error`         |     40 | The homepage returned an error (HTTP 500).                                   |
| `no_https`           |     25 | The website does not use HTTPS, so browsers label it "Not secure".           |
| `slow_mobile`        |  10–25 | Google PageSpeed Insights rates the mobile performance 34/100.               |
| `no_viewport`        |     20 | The homepage has no mobile viewport setting.                                 |
| `free_subdomain`     |     15 | The website runs on a free subdomain (klinik.wixsite.com).                   |
| `slow_lcp`           |   5–10 | For real visitors on phones, the main content takes 5.2 s to appear.         |
| `outdated_copyright` |     10 | The copyright notice on the website says 2019.                               |
| `no_contact_form`    |     10 | The homepage has no contact or booking form.                                 |
| `legacy_jquery`      |      5 | The website loads jQuery 1.x, a library version that is no longer supported. |
| `old_wordpress`      |      5 | The website runs an outdated WordPress version (4.9).                        |
| `no_whatsapp`        |      5 | The homepage has no WhatsApp click-to-chat link.                             |

### Capacity: why they can afford you

| Signal                | Points | Evidence example                                                                        |
| --------------------- | -----: | --------------------------------------------------------------------------------------- |
| `careers_page`        |     20 | Has a careers page ("Karir"), so it is hiring.                                          |
| `multiple_locations`  |     20 | Mentions multiple locations: "3 cabang di Surabaya…"                                    |
| `own_domain`          |     10 | Has its own domain (klinik.co.id).                                                      |
| `business_email`      |     10 | Uses an email address on its own domain.                                                |
| `team_page`           |     10 | Presents its team on the website ("Tim Dokter").                                        |
| `social_presence`     |   5–15 | Links to its Instagram and Facebook from the website.                                   |
| `instagram_followers` |   5–25 | Has 12,400 followers on Instagram (@klinik.senyum). ([Instagram signals](instagram.md)) |
| `instagram_active`    |     10 | Posted on Instagram 5 days ago (@klinik.senyum).                                        |

Arclight also collects the **contact channels** the business publishes on its homepage: email addresses, phone and WhatsApp numbers, and Instagram, Facebook, TikTok and LinkedIn profiles.

**Good to know**

- If a website's `robots.txt` asks automated tools to stay away, Arclight skips the homepage checks and says so on the lead.
- Keyword-based checks (branches, careers, team) look for common Indonesian and English words. They can miss things or misread them. Your 👍 and 👎 ratings help you spot which ones to trust.
- **Audit again** on a lead's page re-checks the website, for example after you've spoken with the business.

## Scores and priority

- **Need** (0–100): the sum of the need points, capped at 100.
- **Capacity** (0–100): the sum of the capacity points, capped at 100.
- **Priority**: the geometric mean, √(need × capacity).

The geometric mean rewards leads that score on _both_ sides. A thriving business with a perfect website (high capacity, no need) and a tiny business with a broken one (high need, no capacity) both rank below an established business with visible problems.

**Businesses without a website** have an unknown capacity (shown as "—"): there is no website to judge from, so their priority is also unknown and they appear after scored leads. If you [set up Instagram signals](instagram.md), a business's Instagram followers and activity give it a capacity; enter its Instagram account on the lead's page if the audit didn't find one. Otherwise its Google rating on the lead page is your best guide.

Colours: green is 60 or more, amber 30–59, grey below 30.

## Writing and sending messages

On a lead's page, **Write messages** asks Claude for a WhatsApp message and an email, based on the audit evidence and your agency profile.

![A lead's evidence, drafts and contact channels](images/lead.png)

The messages follow firm rules:

- They cite only facts from the evidence: no industry statistics, no invented results.
- They are respectful and end with a low-pressure question.
- The email ends with a line telling the recipient they can reply "stop".

**Warnings.** If a draft contains a number (above 30) that doesn't appear in the evidence or your profile, such as "our clients see 200% more bookings", Arclight shows a warning. Remove or check such claims before sending.

**Sending.** Arclight never sends anything. Use:

- **Copy** to paste the message anywhere.
- **Open WhatsApp** to open a chat with the business's WhatsApp or phone number and the message filled in. For businesses without a website, the phone number from Google Maps is offered.
- **Open email** to open your email program with the subject and message filled in.

**Write new drafts** replaces the drafts, for example after you've changed your profile or re-audited the website.

## Pipeline

Each lead has a status: **New → Contacted → Replied → Meeting → Won / Lost**. Change it at the top of the lead's page. The leads list shows the status next to each lead.

## Tuning the scores

Arclight's default points are a starting point. Two tools help you adapt them to your agency.

**Rate leads.** On each lead's page, click **👍 Good lead** or **👎 Not a fit**. Click again to remove the rating.

**Adjust points.** **Settings → Scoring** lists every signal Arclight has found, how many leads have it, and how many of those you rated 👍 or 👎. If a signal shows up mostly on 👎 leads, give it fewer points. Saving recalculates every score immediately; you don't need to re-audit.

## Do-not-contact list

When a business asks not to be contacted, respect it permanently:

- On the lead's page, **Do not contact** adds the website's domain to the list and marks the lead **Lost**.
- **Settings → Do not contact** manages the list: website domains, email addresses and phone numbers, each with an optional reason.

Arclight will then refuse to track that domain again, hide listed emails and phone numbers everywhere, and refuse to write messages for the business.
