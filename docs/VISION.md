# Vision

## The idea

In the films, J.A.R.V.I.S. knows everything about Tony Stark's world and quietly gets things done. Most agencies can't afford a full-time operations or business-development person, so the owner ends up doing that work late at night.

Arclight aims to be that person: an **AI Chief of Staff for agencies**. It understands the agency's services and ideal clients, and it handles the repetitive work that keeps an agency growing.

## The long-term goal: embeddable in any website

Arclight is a standalone service that any agency can plug into its own website or admin panel, whatever that site is built with. Every design choice protects this goal:

- a versioned HTTP API with a published OpenAPI spec, callable from any language;
- an MIT-licensed typed SDK and, later, drop-in UI components;
- a built-in dashboard that uses only the public API, so the embedding path is exercised every day from the first version.

The first integration target is the Vera & Co. admin panel, which is built with Next.js.

## Who it is for

- **Users:** the agency's internal team, including owners, account managers and business-development staff.
- **Not for:** the agency's clients, who never interact with Arclight.
- **Agency types:** web agencies first, then marketing, creative, SEO and branding agencies.

## The first problem: finding clients

Research, lead generation and outreach are slow and inconsistent. They are the first thing dropped when delivery work piles up, and generic cold messages rarely get answers.

Arclight tackles this by:

1. **Finding businesses that fit** through official sources.
2. **Qualifying them on two axes:**
   - **Capacity:** an established business that can pay agency rates. The default target is the established mid-market. Micro-businesses usually can't afford an agency, and large enterprises buy differently.
   - **Need:** a concrete, visible gap the agency can fix.
3. **Personalising with evidence.** Every message cites facts Arclight measured about the prospect. It never uses generic statistics or invented claims.
4. **Keeping a human in charge.** Arclight prepares the message, and a person sends it.

Quality beats volume. Ten well-researched messages a day are worth more to a small agency than a thousand generic ones.

### Initial target segments

Established local businesses with a physical presence, where public signals are reliable: clinics and aesthetic centres, dental practices, private schools, hotels and venues. These are configuration defaults, not hard-coded values. B2B segments such as distributors, manufacturers and law firms need different data sources and are deferred.

## Principles

| Principle                | What it means in practice                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embeddable anywhere**  | API-first. The dashboard is just one client of the API.                                                                                                                                |
| **Human in the loop**    | Nothing is sent, deleted or paid for without a person acting.                                                                                                                          |
| **Official data only**   | Official APIs plus the businesses' own public websites. No scraping of Google Maps, Instagram, Facebook, TikTok or LinkedIn. Arclight respects each provider's terms and `robots.txt`. |
| **Privacy & compliance** | Only business contact data is stored. Arclight keeps a do-not-contact list and follows UU PDP (Indonesia) and, where applicable, GDPR.                                                 |
| **Self-hosted**          | One `docker compose up`. Data leaves the server only for the APIs the agency configures.                                                                                               |
| **Model-agnostic**       | Claude is the default, behind a small provider interface.                                                                                                                              |
| **Concrete first**       | Build the web-agency case well, and generalise only when a second case exists.                                                                                                         |

## Non-goals (for now)

- A client-facing portal or chatbot.
- Automated sending of any kind. Bulk WhatsApp messaging gets numbers banned, and cold email automation puts the agency's domain reputation at risk. Automated email may come later as an opt-in feature with deliverability safeguards.
- Replacing a CRM. Arclight keeps a lightweight pipeline.
- Voice interaction, until the core is useful.

## Long-term direction

Lead Hunter comes first. After that, Arclight grows towards a full Chief of Staff:

- **Agency memory:** services, portfolio, pricing and SOPs, used to ground every answer and draft.
- **Proactive briefings:** e.g. _"12 new qualified leads, 3 replies, and client X's proposal is due Thursday."_
- **Operations help:** proposals, meeting notes, reports and follow-ups.
- **More interfaces:** chat inside any admin panel, then messaging apps and voice.

## Origin

Arclight started as an internal tool for **Vera & Co.**, a website agency. It is open source so other agencies can benefit, and so that it is shaped by more than one agency's needs. Vera & Co. is the first user, and each version must be useful to it before the project moves on.
