import type { Business } from '@arclight/sdk';

export function Score({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="muted">—</span>;
  const level = value >= 60 ? 'high' : value >= 30 ? 'mid' : 'low';
  return (
    <span className={`score score-${level}`} title={label}>
      {value}
    </span>
  );
}

const AUDIT_LABELS = {
  queued: 'Waiting for audit',
  running: 'Auditing…',
  succeeded: 'Audited',
  failed: 'Audit failed',
} as const;

export function AuditStatus({ audit }: { audit: Business['latestAudit'] }) {
  if (!audit) return <span className="muted">Not audited</span>;
  return <span className={`badge badge-${audit.status}`}>{AUDIT_LABELS[audit.status]}</span>;
}

export function isAuditPending(audit: Business['latestAudit']): boolean {
  return audit?.status === 'queued' || audit?.status === 'running';
}
