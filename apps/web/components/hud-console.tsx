import type { CSSProperties } from 'react';
import { Mark } from './logo';

// An illustrative lead scan, animated with CSS only. Every animation settles on its final state and
// is switched off for visitors who prefer reduced motion.

const READOUTS = [
  { label: 'Need', value: 75, tone: 'need' },
  { label: 'Capacity', value: 80, tone: 'capacity' },
  { label: 'Priority', value: 77, tone: 'arc' },
] as const;

const EVIDENCE = [
  { tone: 'need', text: 'No HTTPS. Browsers label the site “Not secure”' },
  { tone: 'need', text: 'Not built for phones: no mobile viewport' },
  { tone: 'need', text: 'Copyright notice still says 2019' },
  { tone: 'capacity', text: '3 branches and a careers page' },
] as const;

// Businesses on the radar, as [angle in degrees, distance from centre in %].
const BLIPS: [number, number][] = [
  [28, 62],
  [104, 38],
  [161, 71],
  [222, 52],
  [297, 80],
  [331, 30],
];

const polar = ([angle, distance]: [number, number]): CSSProperties => ({
  left: `${50 + (distance / 2) * Math.cos((angle * Math.PI) / 180)}%`,
  top: `${50 + (distance / 2) * Math.sin((angle * Math.PI) / 180)}%`,
});

export function HudConsole() {
  return (
    <figure className="console" aria-label="Illustrative example of Arclight scanning a business">
      <span className="bracket tl" aria-hidden="true" />
      <span className="bracket tr" aria-hidden="true" />
      <span className="bracket bl" aria-hidden="true" />
      <span className="bracket br" aria-hidden="true" />

      <header className="console-head">
        <span className="hud-label">Arclight // Lead scan</span>
        <span className="status">
          <span className="status-dot" aria-hidden="true" />
          Live
        </span>
      </header>

      <div className="console-body">
        <div className="radar" aria-hidden="true">
          <span className="radar-sweep" />
          <span className="radar-cross" />
          {BLIPS.map((blip, i) => (
            <span
              key={i}
              className="blip"
              style={{ ...polar(blip), animationDelay: `${i * 0.6}s` }}
            />
          ))}
          <span className="blip target" style={polar([48, 58])}>
            <span className="target-ring" />
          </span>
          <span className="radar-core">
            <Mark id="console-mark" className="radar-mark" />
          </span>
        </div>

        <div className="readouts">
          <p className="target-name">
            <span className="hud-label">Target</span>
            klinik-gigi-senyum.co.id
          </p>
          <p className="target-meta">Dental clinic · Surabaya</p>
          {READOUTS.map((r, i) => (
            <div key={r.label} className={`readout tone-${r.tone}`}>
              <span className="hud-label">{r.label}</span>
              <span className="readout-bar">
                <span
                  className="readout-fill"
                  style={{ '--v': r.value, animationDelay: `${0.4 + i * 0.25}s` } as CSSProperties}
                />
              </span>
              <span className="readout-value">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="evidence-feed">
        {EVIDENCE.map((e, i) => (
          <li
            key={e.text}
            className={`tone-${e.tone}`}
            style={{ animationDelay: `${1.2 + i * 0.35}s` }}
          >
            <span className="feed-tag">{e.tone === 'need' ? 'Need' : 'Capacity'}</span>
            {e.text}
          </li>
        ))}
      </ul>

      <footer className="console-foot">
        <span className="hud-label">Draft ready</span>
        <span className="foot-channels">WhatsApp · Email</span>
        <span className="foot-await">
          Awaiting your review
          <span className="caret" aria-hidden="true" />
        </span>
      </footer>
      <figcaption className="sr-only">
        An illustrative scan of a dental clinic&apos;s website: need 75, capacity 80, priority 77,
        with four pieces of evidence and a draft waiting for review.
      </figcaption>
    </figure>
  );
}
