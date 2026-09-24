import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { components } from '@jarvis/sdk';
import { getJarvis } from '@/lib/jarvis';
import { AutoRefresh } from '../../auto-refresh';
import { AuditStatus, isAuditPending, Score } from '../../components';
import { reauditAction } from './actions';

export const dynamic = 'force-dynamic';

type Signal = components['schemas']['Signal'];
type Contact = components['schemas']['Contact'];

const CONTACT_LABELS: Record<Contact['kind'], string> = {
  email: 'Email',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  other: 'Other',
};

function contactHref(contact: Contact): string {
  switch (contact.kind) {
    case 'email':
      return `mailto:${contact.value}`;
    case 'phone':
      return `tel:${contact.value}`;
    case 'whatsapp':
      return `https://wa.me/${contact.value.replace(/\D/g, '')}`;
    default:
      return contact.value;
  }
}

function SignalList({
  title,
  signals,
  empty,
}: {
  title: string;
  signals: Signal[];
  empty: string;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {signals.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="signals">
          {signals.map((s) => (
            <li key={s.key}>
              <span className="points">+{s.points}</span>
              <span>{s.evidence}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jarvis = getJarvis();
  if (!jarvis) notFound();

  const { data: lead, response } = await jarvis.GET('/businesses/{id}', {
    params: { path: { id } },
  });
  if (response.status === 404 || response.status === 400) notFound();
  if (!lead) throw new Error('Could not load this lead from the JARVIS API.');

  const audit = lead.latestAudit;
  const pending = isAuditPending(audit);
  const reaudit = reauditAction.bind(null, lead.id);

  return (
    <>
      <AutoRefresh active={pending} />
      <p className="small">
        <Link href="/">← All leads</Link>
      </p>
      <header className="lead-header">
        <div>
          <h1>{lead.displayName ?? lead.websiteUrl ?? 'Unnamed business'}</h1>
          {lead.websiteUrl && (
            <a href={lead.websiteUrl} target="_blank" rel="noreferrer noopener" className="muted">
              {lead.websiteUrl}
            </a>
          )}
        </div>
        <form action={reaudit}>
          <button type="submit" className="button secondary" disabled={pending}>
            {pending ? 'Audit in progress…' : 'Audit again'}
          </button>
        </form>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="muted small">Priority</span>
          <Score value={lead.priority} label="Priority" />
        </div>
        <div className="stat">
          <span className="muted small">Need</span>
          <Score value={audit?.needScore ?? null} label="Need" />
        </div>
        <div className="stat">
          <span className="muted small">Capacity</span>
          <Score value={audit?.capacityScore ?? null} label="Capacity" />
        </div>
        <div className="stat">
          <span className="muted small">Audit</span>
          <AuditStatus audit={audit} />
        </div>
      </section>

      {audit?.status === 'failed' && <p className="error">The audit failed: {audit.error}</p>}
      {audit && audit.notes.length > 0 && (
        <ul className="notes small">
          {audit.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {audit?.status === 'succeeded' && (
        <div className="columns">
          <SignalList
            title="Why they need you"
            signals={lead.signals.filter((s) => s.axis === 'need')}
            empty="No website problems found."
          />
          <SignalList
            title="Why they can afford you"
            signals={lead.signals.filter((s) => s.axis === 'capacity')}
            empty="No signs of an established business found on the website."
          />
        </div>
      )}

      <section className="card">
        <h2>Contact channels</h2>
        {lead.contacts.length === 0 ? (
          <p className="muted">No contact channels published on the website.</p>
        ) : (
          <ul className="contacts">
            {lead.contacts.map((c) => (
              <li key={`${c.kind}:${c.value}`}>
                <span className="muted small">{CONTACT_LABELS[c.kind]}</span>
                <a href={contactHref(c)} target="_blank" rel="noreferrer noopener">
                  {c.value}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
