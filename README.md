# JARVIS

> An open-source AI Chief of Staff for agencies.

**Status:** 🧭 Planning, with no code yet. This repository currently holds the project's vision, architecture and roadmap.

JARVIS is a self-hosted AI assistant built for the internal team of an agency: web, marketing, creative, SEO, branding and similar. It knows your agency's services and ideal clients, and it does real work for you. You stay in control of every action that reaches the outside world.

Its first job is the one most agencies find hardest: **finding and reaching the right clients.**

> `JARVIS` is a working codename. The project will get its own public name before a public launch.

---

## The first feature: Lead Hunter

```
Target ──► Discover ──► Qualify ──► Enrich ──► Draft ──► ✋ Approve ──► Send & Track
```

1. **Target.** Describe who you want, e.g. *"Dental clinics in Surabaya with more than one branch."*
2. **Discover.** JARVIS finds matching businesses from official data sources such as the Google Places API.
3. **Qualify.** Each business gets two scores:
   - **Capacity:** can it afford an agency? Signals include review count, branches, a physical office and social presence.
   - **Need:** does it need what you sell? For a web agency that means a slow site, a site that breaks on mobile, no HTTPS, an outdated design or no website at all.
4. **Enrich.** JARVIS collects public business contact channels.
5. **Draft.** It writes a personalised message based on real findings, e.g. *"Your site takes 9 seconds to load on mobile…"*
6. **Approve.** A human reviews every message. Nothing is sent automatically.
7. **Send & Track.** Approved messages go out by email, with scheduled follow-ups and a simple pipeline.

The qualifiers are plugins. A web agency checks website quality, a marketing agency might check ad activity, and an SEO agency might check search visibility.

## Design principles

- **Headless first.** JARVIS is an engine with an API. You can use its built-in dashboard or embed it in your own admin panel.
- **Human in the loop.** Any outbound or destructive action needs explicit approval.
- **Self-hosted.** Your client and lead data stays on your own server.
- **Model-agnostic.** Claude is the default LLM, and you can swap in other providers or local models.
- **Plugin-driven.** Lead sources, qualifiers and channels are replaceable modules.
- **Respectful outreach.** It uses official APIs, public business data, and follows anti-spam and data-protection law (e.g. Indonesia's UU PDP and GDPR).

## Planned stack

| Layer | Choice |
|---|---|
| Core engine | Python · FastAPI |
| Background jobs | Worker queue for discovery and audits |
| Database | PostgreSQL + pgvector |
| Dashboard & UI kit | Next.js · TypeScript · `@jarvis/react` |
| Deployment | Docker Compose |

## Documentation

- [Vision](docs/VISION.md): why JARVIS exists and who it is for
- [Architecture](docs/ARCHITECTURE.md): how the pieces fit together and how to embed JARVIS
- [Roadmap](docs/ROADMAP.md): what gets built, and in what order

## License

[AGPL-3.0](LICENSE). You may use, modify and self-host JARVIS freely. If you offer a modified version as a network service, you must publish your source code.
