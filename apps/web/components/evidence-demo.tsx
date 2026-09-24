// Shows how a draft cites only measured facts, and how an unmeasured number is flagged.

const EVIDENCE = [
  {
    ref: 'a',
    points: 25,
    text: 'The website does not use HTTPS, so browsers label it “Not secure”.',
  },
  {
    ref: 'b',
    points: 20,
    text: 'The homepage has no mobile viewport setting, so it is not designed for phones.',
  },
  { ref: 'c', points: 10, text: 'The copyright notice on the website says 2019.' },
];

export function EvidenceDemo() {
  return (
    <div
      className="evidence-demo"
      aria-label="Illustrative example: audit evidence and the draft built from it"
    >
      <div className="panel">
        <p className="panel-title">
          <span className="hud-label">Audit evidence</span>
          <span className="panel-score tone-need">Need 75</span>
        </p>
        <ul className="evidence-list">
          {EVIDENCE.map((e) => (
            <li key={e.ref}>
              <span className={`ref ref-${e.ref}`} aria-hidden="true" />
              <span className="points">+{e.points}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <p className="panel-title">
          <span className="hud-label">WhatsApp draft</span>
          <span className="panel-score muted">Written by Claude</span>
        </p>
        <div className="bubble">
          Hello, I&apos;m Maya from Northwind Studio. I noticed your clinic&apos;s website{' '}
          <mark className="cite cite-a">shows as “Not secure” in browsers</mark> and{' '}
          <mark className="cite cite-b">isn&apos;t designed for phones</mark>, where most patients
          look for a dentist. We help clinics fix exactly this, and{' '}
          <mark className="cite cite-x">our clients see 200% more bookings</mark>. Would a short,
          free review be useful?
        </div>
        <p className="flag" role="note">
          <span aria-hidden="true">⚠</span> “200%” is not in the audit evidence. Check it before
          sending.
        </p>
        <div className="send-row" aria-hidden="true">
          <span className="chip">Copy</span>
          <span className="chip chip-primary">Open WhatsApp</span>
        </div>
      </div>
    </div>
  );
}
