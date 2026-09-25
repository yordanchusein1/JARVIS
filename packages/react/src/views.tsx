'use client';

import type { ReactNode } from 'react';
import type { Briefing, Business, BusinessDetail, LeadStatus, SendLink } from '@arclight/sdk';

/**
 * Presentational pieces. They take data and callbacks and fetch nothing, so they can also be used
 * with data you load yourself.
 */

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'replied',
  'meeting',
  'won',
  'lost',
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
};

const AUDIT_LABELS = {
  queued: 'Waiting for audit',
  running: 'Auditing…',
  succeeded: 'Audited',
  failed: 'Audit failed',
} as const;

export function leadName(b: Pick<Business, 'displayName' | 'websiteUrl' | 'placeId'>): string {
  return b.displayName ?? b.websiteUrl ?? (b.placeId ? 'Google Maps business' : 'Unnamed business');
}

export function isAuditPending(b: Pick<Business, 'latestAudit'>): boolean {
  return b.latestAudit?.status === 'queued' || b.latestAudit?.status === 'running';
}

export function Score({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="arc-score arc-score-none" title={`${label}: unknown`}>
        —
      </span>
    );
  }
  const level = value >= 60 ? 'high' : value >= 30 ? 'mid' : 'low';
  return (
    <span className={`arc-score arc-score-${level}`} title={label}>
      {value}
    </span>
  );
}

export function AuditBadge({ audit }: { audit: Business['latestAudit'] }) {
  if (!audit) return <span className="arc-muted">Not audited</span>;
  return (
    <span className={`arc-badge arc-badge-${audit.status}`}>{AUDIT_LABELS[audit.status]}</span>
  );
}

function LeadName({ lead, href }: { lead: Business; href: string | null }) {
  return href ? (
    <a className="arc-lead-link" href={href}>
      {leadName(lead)}
    </a>
  ) : (
    <strong>{leadName(lead)}</strong>
  );
}

export function SendButtons({ links }: { links: SendLink[] }) {
  if (links.length === 0)
    return <span className="arc-muted arc-small">No WhatsApp or email found</span>;
  return (
    <span className="arc-actions">
      {links.map((link) => (
        <a
          key={link.href}
          className="arc-button arc-button-small"
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          title={link.label}
        >
          {link.channel === 'whatsapp' ? 'Send on WhatsApp' : 'Send by email'}
        </a>
      ))}
    </span>
  );
}

export function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: LeadStatus;
  onChange: (status: LeadStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="arc-select"
      aria-label="Pipeline status"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as LeadStatus)}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function Notice({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={error ? 'arc-error' : 'arc-muted'}>{children}</p>;
}

export function BriefingView({
  briefing,
  sendOptions,
  leadHref,
  title = 'Last 24 hours',
}: {
  briefing: Briefing;
  /** Send links per ready lead id. */
  sendOptions: Record<string, SendLink[]>;
  leadHref: (id: string) => string | null;
  title?: string;
}) {
  const days = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  const failed = briefing.huntRuns.filter((r) => r.status === 'failed');
  return (
    <section className="arc-card arc-briefing">
      <h2 className="arc-title">{title}</h2>
      <div className="arc-stats">
        <Stat label="New leads" value={briefing.newLeads} />
        <Stat label="Audited" value={briefing.audited} />
        <Stat label="Ready to send" value={briefing.readyToSendTotal} />
        <Stat label="Follow-ups due" value={briefing.followUpsTotal} />
      </div>
      <div className="arc-columns">
        <div>
          <h3 className="arc-subtitle">Ready to send</h3>
          {briefing.readyToSend.length === 0 ? (
            <Notice>No drafts waiting.</Notice>
          ) : (
            <ul className="arc-list">
              {briefing.readyToSend.map((b) => (
                <li key={b.id}>
                  <Score value={b.priority} label="Priority" />
                  <span className="arc-stack">
                    <LeadName lead={b} href={leadHref(b.id)} />
                    <SendButtons links={sendOptions[b.id] ?? []} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="arc-subtitle">Follow up</h3>
          {briefing.followUps.length === 0 ? (
            <Notice>No one is waiting for a follow-up.</Notice>
          ) : (
            <ul className="arc-list">
              {briefing.followUps.map(({ business, contactedAt }) => (
                <li key={business.id}>
                  <span className="arc-muted arc-small">{days(contactedAt)}d</span>
                  <LeadName lead={business} href={leadHref(business.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {failed.length > 0 && (
        <Notice error>
          {failed.length === 1 ? 'A hunt' : `${failed.length} hunts`} failed: {failed[0]!.error}
        </Notice>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="arc-stat">
      <span className="arc-muted arc-small">{label}</span>
      <strong className="arc-stat-value">{value}</strong>
    </div>
  );
}

export function LeadListView({
  leads,
  leadHref,
}: {
  leads: Business[];
  leadHref: (id: string) => string | null;
}) {
  if (leads.length === 0) return <Notice>No leads yet.</Notice>;
  return (
    <div className="arc-table-wrap">
      <table className="arc-table">
        <thead>
          <tr>
            <th>Business</th>
            <th className="arc-num">Priority</th>
            <th className="arc-num">Need</th>
            <th className="arc-num">Capacity</th>
            <th>Audit</th>
            <th>Pipeline</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((b) => (
            <tr key={b.id}>
              <td>
                <LeadName lead={b} href={leadHref(b.id)} />
                {b.displayName && b.websiteUrl && (
                  <div className="arc-muted arc-small">{b.websiteUrl}</div>
                )}
              </td>
              <td className="arc-num">
                <Score value={b.priority} label="Priority" />
              </td>
              <td className="arc-num">
                <Score value={b.latestAudit?.needScore ?? null} label="Need" />
              </td>
              <td className="arc-num">
                <Score value={b.latestAudit?.capacityScore ?? null} label="Capacity" />
              </td>
              <td>
                <AuditBadge audit={b.latestAudit} />
              </td>
              <td>{STATUS_LABELS[b.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PipelineView({
  leads,
  leadHref,
  onMove,
  busyId,
}: {
  leads: Business[];
  leadHref: (id: string) => string | null;
  onMove: (id: string, status: LeadStatus) => void;
  busyId?: string | null;
}) {
  return (
    <div className="arc-pipeline">
      {LEAD_STATUSES.map((status) => {
        const column = leads.filter((b) => b.status === status);
        return (
          <section key={status} className="arc-pipeline-column" aria-label={STATUS_LABELS[status]}>
            <h3 className="arc-subtitle">
              {STATUS_LABELS[status]} <span className="arc-muted">{column.length}</span>
            </h3>
            {column.map((b) => (
              <div key={b.id} className="arc-pipeline-card">
                <LeadName lead={b} href={leadHref(b.id)} />
                <span className="arc-actions">
                  <Score value={b.priority} label="Priority" />
                  <StatusSelect
                    value={b.status}
                    disabled={busyId === b.id}
                    onChange={(next) => onMove(b.id, next)}
                  />
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function LeadDetailView({
  lead,
  sendLinksFor,
  placeName,
  busy,
  error,
  onWriteDrafts,
  onStatus,
  onReaudit,
}: {
  lead: BusinessDetail;
  /** Send links for a draft id. */
  sendLinksFor: (draftId: string) => SendLink[];
  /** The live Google Maps name, for businesses found there. */
  placeName?: string | null;
  busy?: boolean;
  error?: string | null;
  onWriteDrafts: () => void;
  onStatus: (status: LeadStatus) => void;
  onReaudit: () => void;
}) {
  const audit = lead.latestAudit;
  const need = lead.signals.filter((s) => s.axis === 'need');
  const capacity = lead.signals.filter((s) => s.axis === 'capacity');
  return (
    <article className="arc-lead">
      <header className="arc-lead-header">
        <div>
          <h2 className="arc-title">{lead.displayName ?? placeName ?? leadName(lead)}</h2>
          {lead.websiteUrl && (
            <a
              className="arc-small"
              href={lead.websiteUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {lead.websiteUrl}
            </a>
          )}
        </div>
        <span className="arc-actions">
          <StatusSelect value={lead.status} onChange={onStatus} disabled={busy} />
          <button
            type="button"
            className="arc-button arc-button-secondary"
            onClick={onReaudit}
            disabled={busy}
          >
            Audit again
          </button>
        </span>
      </header>

      {lead.doNotContact && (
        <Notice error>
          This business is on the do-not-contact list. Arclight will not write messages for it.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}

      <div className="arc-stats">
        <div className="arc-stat">
          <span className="arc-muted arc-small">Priority</span>
          <Score value={lead.priority} label="Priority" />
        </div>
        <div className="arc-stat">
          <span className="arc-muted arc-small">Need</span>
          <Score value={audit?.needScore ?? null} label="Need" />
        </div>
        <div className="arc-stat">
          <span className="arc-muted arc-small">Capacity</span>
          <Score value={audit?.capacityScore ?? null} label="Capacity" />
        </div>
        <div className="arc-stat">
          <span className="arc-muted arc-small">Audit</span>
          <AuditBadge audit={audit} />
        </div>
      </div>
      {audit?.status === 'failed' && <Notice error>The audit failed: {audit.error}</Notice>}

      {audit?.status === 'succeeded' && (
        <div className="arc-columns">
          <Evidence title="Why they need you" signals={need} />
          <Evidence title="Why they can afford you" signals={capacity} />
        </div>
      )}

      <section className="arc-card">
        <div className="arc-lead-header">
          <h3 className="arc-subtitle">Messages</h3>
          {audit?.status === 'succeeded' && !lead.doNotContact && (
            <button type="button" className="arc-button" onClick={onWriteDrafts} disabled={busy}>
              {busy ? 'Working…' : lead.drafts.length > 0 ? 'Write new drafts' : 'Write messages'}
            </button>
          )}
        </div>
        {lead.drafts.length === 0 ? (
          <Notice>No drafts yet.</Notice>
        ) : (
          lead.drafts.map((draft) => (
            <div key={draft.id} className="arc-draft">
              <strong className="arc-small">
                {draft.channel === 'whatsapp'
                  ? 'WhatsApp message'
                  : `Email: ${draft.subject ?? ''}`}
              </strong>
              <p className="arc-draft-body">{draft.body}</p>
              {draft.warnings.map((w) => (
                <p key={w} className="arc-warning arc-small">
                  ⚠ {w}
                </p>
              ))}
              <SendButtons links={sendLinksFor(draft.id)} />
            </div>
          ))
        )}
      </section>
    </article>
  );
}

function Evidence({ title, signals }: { title: string; signals: BusinessDetail['signals'] }) {
  return (
    <section className="arc-card">
      <h3 className="arc-subtitle">{title}</h3>
      {signals.length === 0 ? (
        <Notice>Nothing found.</Notice>
      ) : (
        <ul className="arc-list">
          {signals.map((s) => (
            <li key={s.key}>
              <span className="arc-muted arc-small">+{s.points}</span>
              <span>{s.evidence}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
