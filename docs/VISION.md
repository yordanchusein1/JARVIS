# Vision

## The idea

In the films, J.A.R.V.I.S. knows everything about Tony Stark's world and quietly gets things done. Most agencies can't afford a full-time operations or business-development person, so the owner ends up doing that work late at night.

JARVIS aims to be that person: an **AI Chief of Staff for agencies**. It knows the agency's services, clients and ideal customers, and it takes on the repetitive work that keeps an agency growing.

## Who it is for

- **Primary users:** the agency's internal team, including owners, account managers and business-development staff.
- **Not for:** the agency's clients. JARVIS is an internal tool, and clients never interact with it directly.
- **Agency types:** web and software agencies first (the founding use case is [Vera & Co.](#origin), a website agency), then marketing, creative, SEO and branding agencies through plugins.

## The first problem: finding clients

Research, lead generation and outreach are slow and inconsistent, and they are the first thing dropped when delivery work piles up. Generic cold outreach also performs badly.

JARVIS tackles this by:

1. **Finding businesses that fit.** It searches official data sources for businesses matching the agency's ideal customer profile.
2. **Qualifying on two axes:**
   - **Capacity:** is this an established business that can pay agency rates? The default target is the mid-market, meaning established companies. Micro-businesses usually can't afford an agency, and large enterprises have different procurement.
   - **Need:** is there a concrete, visible gap the agency can fix?
3. **Personalising with evidence.** Each outreach message cites real findings about the prospect, such as audit results, instead of generic claims.
4. **Keeping a human in charge.** JARVIS drafts and a person approves.

### Example target segments (defaults for a web agency)

Clinics and aesthetic centres, private schools, law and consulting firms, property developers, hotels and venues, and B2B distributors or manufacturers. These are configuration, not hard-coded values.

## Principles

| Principle | What it means in practice |
|---|---|
| **Headless first** | The engine exposes an API. The dashboard is one client among many, and agencies can embed JARVIS in their own admin panels. |
| **Human in the loop** | Sending messages, deleting data or spending money always requires explicit approval. |
| **Self-hosted & private** | One `docker compose up`, and data never leaves the agency's infrastructure except for the LLM and data-source APIs it configures. |
| **Model-agnostic** | Claude is the default. Providers sit behind an interface so other hosted or local models can be used. |
| **Plugin-driven** | Lead sources, qualifiers, enrichers and channels are plugins. The core stays small. |
| **Respectful outreach** | Official APIs only (no scraping that violates terms of service), public business data only, opt-out honoured, rate limits enforced, compliant with UU PDP (Indonesia) and GDPR where applicable. |
| **Useful on day one** | Sensible defaults for a web agency, so the first run produces real leads. |

## Non-goals (for now)

- A client-facing portal or chatbot.
- Automated bulk WhatsApp or SMS messaging. It gets numbers banned and is often unlawful. JARVIS can prepare a WhatsApp message with a `wa.me` link for a human to send by hand.
- Replacing a full CRM. JARVIS keeps a lightweight pipeline and may sync to CRMs later.
- Voice interaction. It is planned, but only after the core is useful.

## Long-term direction

Lead Hunter comes first. The longer-term aim is a full Chief of Staff:

- **Agency memory:** a knowledge base of services, past projects, pricing and SOPs, used to ground every answer and draft.
- **Proactive briefings:** e.g. *"Good morning: 12 new qualified leads, 3 replies, and client X's proposal is due Thursday."*
- **Operations help:** proposals, meeting notes, reports and follow-ups.
- **More interfaces:** chat inside the admin panel first, then messaging apps and voice.

## Origin

JARVIS started as an internal tool for **Vera & Co.**, a website agency. It is open-sourced so other agencies can benefit from it, and so it is tested against more than one agency's needs. Vera & Co. runs JARVIS as a separate service and embeds it in its own private admin panel, which is the integration pattern this project is designed around.
