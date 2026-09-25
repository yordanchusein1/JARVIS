import Link from 'next/link';
import type { Briefing, Business, SendLink } from '@arclighthq/sdk';
import { daysSince, greeting } from '@/lib/format';
import { Score } from './components';

const nameOf = (b: Business) =>
  b.displayName ?? b.websiteUrl ?? (b.placeId ? 'Google Maps business' : 'Unnamed business');

/** What Arclight did in the last day and what needs a person now. */
export function BriefingPanel({
  briefing,
  timeZone,
  senderName,
  hasHunts,
  sendOptions,
}: {
  briefing: Briefing;
  timeZone: string;
  senderName: string;
  hasHunts: boolean;
  /** WhatsApp and email links with the drafts filled in, per ready lead. */
  sendOptions: Record<string, SendLink[]>;
}) {
  const failedRuns = briefing.huntRuns.filter((r) => r.status === 'failed');
  const foundByHunts = briefing.huntRuns.reduce((sum, r) => sum + r.tracked, 0);

  return (
    <section className="card briefing" aria-labelledby="briefing-title">
      <div className="section-header">
        <h2 id="briefing-title">
          {greeting(timeZone)}
          {senderName ? `, ${senderName}` : ''}.
        </h2>
        <span className="muted small">Last 24 hours</span>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="muted small">New leads</span>
          <strong className="stat-value">{briefing.newLeads}</strong>
          {foundByHunts > 0 && <span className="muted small">{foundByHunts} found by hunts</span>}
        </div>
        <div className="stat">
          <span className="muted small">Audited</span>
          <strong className="stat-value">{briefing.audited}</strong>
          {briefing.auditsFailed > 0 && (
            <span className="error small">{briefing.auditsFailed} failed</span>
          )}
        </div>
        <div className="stat">
          <span className="muted small">Ready to send</span>
          <strong className="stat-value">{briefing.readyToSendTotal}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Follow-ups due</span>
          <strong className="stat-value">{briefing.followUpsTotal}</strong>
        </div>
      </div>

      <div className="columns">
        <div>
          <h3>Ready to send</h3>
          {briefing.readyToSend.length === 0 ? (
            <p className="muted small">No drafts waiting.</p>
          ) : (
            <ul className="briefing-list">
              {briefing.readyToSend.map((b) => (
                <li key={b.id}>
                  <Score value={b.priority} label="Priority" />
                  <div className="ready">
                    <Link href={`/leads/${b.id}`} className="lead-link">
                      {nameOf(b)}
                    </Link>
                    <span className="send-links">
                      {(sendOptions[b.id] ?? []).map((link) => (
                        <a
                          key={link.href}
                          className="button small-button"
                          href={link.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={link.label}
                        >
                          {link.channel === 'whatsapp' ? 'Send on WhatsApp' : 'Send by email'}
                        </a>
                      ))}
                      {(sendOptions[b.id] ?? []).length === 0 && (
                        <span className="muted small">No WhatsApp or email found</span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Follow up</h3>
          {briefing.followUps.length === 0 ? (
            <p className="muted small">No one is waiting for a follow-up.</p>
          ) : (
            <ul className="briefing-list">
              {briefing.followUps.map(({ business, contactedAt }) => (
                <li key={business.id}>
                  <span className="muted small">{daysSince(contactedAt)}d</span>
                  <Link href={`/leads/${business.id}`} className="lead-link">
                    {nameOf(business)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {failedRuns.length > 0 ? (
        <p className="error small">
          {failedRuns.length === 1 ? 'A hunt' : `${failedRuns.length} hunts`} failed:{' '}
          {failedRuns[0]!.error} <Link href="/hunts">Open hunts</Link>
        </p>
      ) : (
        !hasHunts && (
          <p className="muted small">
            <Link href="/hunts">Set up a hunt</Link> and Arclight will look for new leads every
            morning on its own.
          </p>
        )
      )}
    </section>
  );
}
