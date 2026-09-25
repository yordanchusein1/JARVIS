# Instagram signals

Many established businesses in Indonesia are more active on Instagram than on their website, and some have no website at all. With Instagram access set up, every audit also reads the business's Instagram account:

| Signal                | Axis     | Points | Example evidence                                                            |
| --------------------- | -------- | -----: | --------------------------------------------------------------------------- |
| `instagram_followers` | Capacity |   5–25 | Has 12,400 followers on Instagram (@klinik.senyum).                         |
| `instagram_active`    | Capacity |     10 | Posted on Instagram 5 days ago (@klinik.senyum), so the business is active. |
| `instagram_inactive`  | Need     |     10 | The Instagram account @klinik.senyum hasn't posted for 7 months.            |

Followers give 5 points from 500, 15 from 2,000 and 25 from 10,000. Like every signal, the points can be changed under **Settings → Scoring**.

For a **business without a website**, these signals are what gives it a capacity score, and with it a priority, instead of "unknown" ([D9](DECISIONS.md#d9-capacity-for-businesses-without-a-website-comes-from-instagram-not-google)).

## Which account is read

- The Instagram profile the business links from its own website, found during the audit.
- Or an account you enter yourself on the lead's page under **Contact channels** (for example, one you found on the business's Google Maps profile). Saving it starts a new audit.

Only **business and creator accounts** can be read; for a personal account the audit notes that it couldn't. Arclight uses Meta's official Instagram Graph API (Business Discovery) and never scrapes Instagram. It stores only the numbers above, refreshed at every audit.

## Setting up access

Business Discovery works through **your agency's own Instagram business account**, so you need, once:

1. An Instagram **professional** (business or creator) account for your agency, connected to a **Facebook Page** you manage.
2. A **Meta developer app** ([developers.facebook.com](https://developers.facebook.com/)) of the Business type with the Instagram Graph API ("Instagram API with Facebook Login") added.
3. The permissions **`instagram_basic`** and **`pages_read_engagement`** (and `pages_show_list` to find your account). Reading _other_ businesses' accounts needs **Advanced Access**, which Meta grants through **App Review**, usually together with **Business Verification** of your agency. Plan a few days for this.
4. An **access token** for your account. A token from a **system user** in Meta Business Suite doesn't expire; a normal user token has to be renewed about every 60 days.
5. Your **Instagram business account ID** (a long number, not your username). Meta's Graph API Explorer shows it under `me/accounts` → your Page → `instagram_business_account`.

Meta's screens and requirements change often; follow Meta's current guide for [Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery) and [access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens) when in doubt.

Then add to `.env` and restart the worker:

```sh
INSTAGRAM_ACCESS_TOKEN=EAAG...
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400000000000
```

```sh
docker compose up -d worker
```

Open a lead with an Instagram account and click **Audit again**. If something is wrong, the audit's notes say so, for example "Instagram checks failed: Instagram returned HTTP 400: Invalid OAuth access token".

## Limits

Meta limits how many Graph API calls an app makes per hour (the limit grows with your account's activity). Each audit makes at most one Instagram call, so hunts of a few dozen new leads a day stay far below it.
