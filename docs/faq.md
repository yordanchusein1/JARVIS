# Frequently asked questions

## Using Arclight

### Does Arclight send messages for me?

No, and it never will on its own. Arclight writes drafts; a person reads them and sends them with one click through WhatsApp or their email program. Automated cold messaging gets WhatsApp numbers banned and damages email domains, and a small agency needs well-researched messages more than a high volume of them. See [decision D4](DECISIONS.md#d4-no-automated-sending-in-v01).

### Which kinds of agencies is it for?

Arclight's checks are tuned for **web agencies** first: they look for problems a website agency can fix. Marketing, SEO and creative agencies can use it today with manual judgement, and dedicated checks for them are on the [roadmap](ROADMAP.md).

### Which languages can the messages be in?

Bahasa Indonesia and English. The audit evidence is in English; Claude translates it when writing Indonesian messages.

### Why do some leads show "Google Maps business" instead of a name?

Google's terms don't allow storing names or other details from Google Maps. Arclight keeps only the place ID and shows the name live on the lead's page. Once Arclight has visited the business's own website, it uses the name from the website.

### Why is capacity "—" for some leads?

Arclight judges capacity from a business's website. Businesses without one have an unknown capacity until Instagram signals arrive in v0.2. Use the Google rating shown on the lead's page in the meantime.

## Costs

### What does it cost to run?

Arclight itself is free and open source. You pay the services it uses:

| Service                       | How it's billed                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Places API (New)       | Per request, with a monthly free allowance. See [Google Maps Platform pricing](https://mapsplatform.google.com/pricing/).                                              |
| Google PageSpeed Insights API | Free with an API key, within Google's daily limits                                                                                                                     |
| Claude (Anthropic)            | Per token. A pair of drafts for one lead is a short request, typically a few US cents with the default model. See [Claude pricing](https://www.anthropic.com/pricing). |
| Server                        | A small VPS, if you don't run it on your own computer                                                                                                                  |

To spend less on drafts, set `ANTHROPIC_MODEL` to a smaller Claude model. Check how the drafts read before relying on it.

## Data, privacy and law

### Where does my data go?

Your leads, scores, drafts and settings stay in the PostgreSQL database on your server. Arclight sends data to other services only to do its job:

- **The businesses' websites** are visited to audit them.
- **Google** receives your search terms, place IDs and the website addresses to speed-test.
- **Anthropic** receives, for each draft, the business's name and website, the audit evidence and your agency profile.

Nothing is sent to the Arclight project.

### Is using Arclight legal?

Arclight is designed to make responsible outreach easy: it uses official APIs, stores no Google Maps content, honours `robots.txt`, collects only contact details that businesses publish themselves, keeps a do-not-contact list and never sends messages automatically. It was designed with Indonesia's personal data protection law (UU PDP) and the EU's GDPR in mind.

Whether a particular outreach campaign is lawful still depends on where you and your prospects are, and on how you use the tool. This FAQ isn't legal advice; check your local rules, contact businesses rather than private individuals, and always honour requests to stop.

### How does Arclight respect Google's terms?

The Google Maps Platform Terms forbid copying and saving business names, addresses and reviews. Arclight searches live, stores only place IDs, and shows Google details live without saving them. See [decision D3](DECISIONS.md#d3-official-data-sources-only).

## The project

### Who makes Arclight?

Arclight started as an internal tool at Vera & Co., a website agency in Indonesia, and is developed in the open. It is in **early access**: expect changes, and please [report problems](https://github.com/yordanchusein1/arclight/issues).

### Can I use another AI model instead of Claude?

Not yet from the settings. Drafting sits behind a small interface (`DraftWriter` in `packages/core`), so other providers can be added; contributions are welcome.

### Can AI agents use Arclight?

An MCP server that lets agents such as Claude or Hermes Agent use Arclight as a tool is planned for v0.2. Today, agents and scripts can use the [HTTP API](api.md).

### Is Arclight related to Iron Man or Marvel?

No. The name is a nod to a light that never switches off. Arclight is not affiliated with Marvel.
