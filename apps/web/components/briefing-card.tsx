// An illustration of the daily briefing in the dashboard.

const ITEMS = [
  { value: '12', label: 'new qualified leads found overnight' },
  { value: '3', label: 'messages ready to send' },
  { value: '2', label: 'follow-ups due today' },
];

export function BriefingCard() {
  return (
    <div className="briefing" aria-label="Illustration of the daily briefing">
      <p className="briefing-head">
        <span className="hud-label">07:00 · Daily briefing</span>
      </p>
      <p className="briefing-hello">Good morning. While you were away:</p>
      <ul className="briefing-stats">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <span className="stat-value">{item.value}</span>
            <span className="stat-label">{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="briefing-top">
        <span className="hud-label">Top pick</span>A dental clinic with three branches whose site
        takes 9.1 s to load on phones. Draft ready.
      </p>
    </div>
  );
}
