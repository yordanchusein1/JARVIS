# Arclight brand guide

## The idea

An arc reactor is a light that never switches off. Arclight is the same for an agency's pipeline: it keeps working when you don't, and it lights up opportunities that were hard to see.

The mark is an **A** inside an open ring, with a point of light at its core. The ring is left open at the bottom: Arclight always leaves the final step, sending a message, to a person.

- **Name in text:** Arclight (never ARCLIGHT or ArcLight in running text)
- **Wordmark:** ARCLIGHT, set in capitals with wide tracking
- **Tagline:** _Your agency's always-on lead hunter._

## Logo files

| File                                     | Use                                        |
| ---------------------------------------- | ------------------------------------------ |
| [`logo-on-dark.svg`](logo-on-dark.svg)   | Horizontal logo for dark backgrounds       |
| [`logo-on-light.svg`](logo-on-light.svg) | Horizontal logo for light backgrounds      |
| [`mark.svg`](mark.svg)                   | Mark alone, dark backgrounds               |
| [`mark-on-light.svg`](mark-on-light.svg) | Mark alone, light backgrounds              |
| [`mark-mono.svg`](mark-mono.svg)         | One colour; inherits `currentColor`        |
| [`wordmark.svg`](wordmark.svg)           | Wordmark alone; inherits `currentColor`    |
| [`app-icon.svg`](app-icon.svg)           | App and social avatar (on ink)             |
| [`favicon.svg`](favicon.svg)             | Browser tab icon; heavier strokes for 16px |

The wordmark is converted to outlines, so the logo looks the same without the font installed. [`tools/generate.mjs`](tools/generate.mjs) regenerates every file.

**Clear space:** keep at least half the mark's height empty around the logo.
**Minimum size:** mark 20 px, horizontal logo 96 px wide, favicon 16 px.

**Don't** recolour the ring outside the palette, add effects other than the arc glow, stretch or rotate the logo, or pair it with Iron Man or Marvel imagery. Arclight is not affiliated with Marvel.

## Colour

Arclight is dark-first: it looks like an instrument panel. Light mode uses the same hues, deepened for contrast.

### Core

| Token      | Dark      | Light     | Use                              |
| ---------- | --------- | --------- | -------------------------------- |
| `bg`       | `#04070C` | `#F5F8FC` | Page background ("ink")          |
| `surface`  | `#080D15` | `#FFFFFF` | Cards and panels                 |
| `raised`   | `#0E1622` | `#EEF3F9` | Inputs, code, nested panels      |
| `border`   | `#172233` | `#D9E2EE` | Hairlines                        |
| `text`     | `#E8EEF6` | `#0A1220` | Body text                        |
| `muted`    | `#8B9AB0` | `#52627A` | Secondary text                   |
| `arc`      | `#3FD0FF` | `#0B6A95` | Accent, links, focus             |
| `arc-soft` | `#7FE3FF` | `#0A8CC4` | Highlights, the core of the mark |

### Arc scale

`#B8F1FF` · `#7FE3FF` · `#3FD0FF` · `#12B5F0` · `#0A8CC4` · `#0B6A95`

The signature gradient runs from `#B8F1FF` through `#3FD0FF` to `#0A8CC4` at 135°. Use it for the mark, one headline phrase, and primary buttons. Never use it for body text.

### Signals

| Token      | Colour    | Meaning                                   |
| ---------- | --------- | ----------------------------------------- |
| `need`     | `#FFB23F` | Why a business needs the agency           |
| `capacity` | `#34D399` | Why a business can afford the agency      |
| `alert`    | `#FF5A76` | Do-not-contact, errors, unverified claims |

## Typography

All three typefaces are open source (SIL Open Font License) and self-hosted.

| Role    | Typeface       | Use                                                    |
| ------- | -------------- | ------------------------------------------------------ |
| Display | Space Grotesk  | Headlines, the wordmark. Weight 600, tracking −0.02em  |
| Text    | Inter          | Body, UI                                               |
| Data    | JetBrains Mono | Labels, scores and readouts. Capitals, tracking 0.12em |

## Visual language

- **Instrument panel, not sci-fi costume.** Hairline borders, corner brackets, monospaced readouts and a faint grid.
- **Light is information.** Glow marks what matters, such as the core of the mark, a live status or a priority score. If everything glows, nothing does.
- **Motion is calm.** A slow radar sweep and readouts that settle. Every animation respects `prefers-reduced-motion`.

## Voice

Arclight sounds like a capable co-pilot: calm, precise and on your side.

| Do                                                     | Don't                                    |
| ------------------------------------------------------ | ---------------------------------------- |
| "Arclight drafts. You send."                           | "Put your outreach on autopilot!"        |
| "Their homepage takes 8.9 s to load on phones."        | "Most websites lose 53% of visitors."    |
| "Early access. Used by one agency so far."             | "Trusted by agencies worldwide."         |
| Short sentences with concrete nouns and measured facts | Hype, fake urgency, unverifiable numbers |

Claims about Arclight follow the same rule as its outreach: say only what has been measured.
