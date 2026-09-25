import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { components } from '@arclighthq/sdk';
import { getArclight } from '@/lib/arclight';
import { contactsWithGooglePhone } from '@/lib/lead-contacts';
import { AutoRefresh } from '../../auto-refresh';
import { AuditStatus, isAuditPending, Score } from '../../components';
import { doNotContactAction, feedbackAction, reauditAction, statusAction } from './actions';
import { DraftButton } from './draft-button';
import { DraftCard } from './drafts';

export const dynamic = 'force-dynamic';

type Signal = components['schemas']['Signal'];
type Contact = components['schemas']['Contact'];

const STATUSES = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['replied', 'Replied'],
  ['meeting', 'Meeting'],
  ['won', 'Won'],
  ['lost', 'Lost'],
] as const;

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
  const arclight = await getArclight();
  if (!arclight) notFound();

  const { data: lead, response } = await arclight.GET('/businesses/{id}', {
    params: { path: { id } },
  });
  if (response.status === 404 || response.status === 400) notFound();
  if (!lead) throw new Error('Could not load this lead from the Arclight API.');

  // Live Google details for businesses found through Places search. Never stored (Google's terms).
  const { contacts, place } = await contactsWithGooglePhone(arclight, lead);

  const audit = lead.latestAudit;
  const pending = isAuditPending(audit);
  const reaudit = reauditAction.bind(null, lead.id);
  const updateStatus = statusAction.bind(null, lead.id);

  return (
    <>
      <AutoRefresh active={pending} />
      <p className="small">
        <Link href="/">← All leads</Link>
      </p>
      <header className="lead-header">
        <div>
          <h1>{lead.displayName ?? place?.name ?? lead.websiteUrl ?? 'Unnamed business'}</h1>
          {lead.websiteUrl && (
            <a href={lead.websiteUrl} target="_blank" rel="noreferrer noopener" className="muted">
              {lead.websiteUrl}
            </a>
          )}
        </div>
        <div className="actions">
          {/* Keyed by status: React resets forms after an action, which would show the old value. */}
          <form key={lead.status} action={updateStatus} className="actions">
            <label className="muted small" htmlFor="status">
              Pipeline
            </label>
            <select id="status" name="status" className="input compact" defaultValue={lead.status}>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="button secondary">
              Update
            </button>
          </form>
          <form action={reaudit}>
            <button type="submit" className="button secondary" disabled={pending}>
              {pending ? 'Audit in progress…' : 'Audit again'}
            </button>
          </form>
        </div>
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

      {lead.doNotContact && (
        <p className="banner">
          This business is on the do-not-contact list. Arclight will not write messages for it.
        </p>
      )}

      {place && (
        <section className="card">
          <h2>On Google Maps</h2>
          <p className="small">
            {place.name} · {place.address}
            {place.rating !== null && ` · ${place.rating} ★ from ${place.ratingCount ?? 0} reviews`}
            {place.mapsUrl && (
              <>
                {' · '}
                <a href={place.mapsUrl} target="_blank" rel="noreferrer noopener">
                  Open in Google Maps
                </a>
              </>
            )}
          </p>
          <p className="muted small">Shown live from Google and not stored.</p>
        </section>
      )}

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
            empty={
              lead.signals.some((s) => s.key === 'no_website')
                ? 'Unknown: there is no website to judge from. Check the Google rating above.'
                : 'No signs of an established business found on the website.'
            }
          />
        </div>
      )}

      {audit?.status === 'succeeded' && (
        <section className="drafts">
          <div className="section-header">
            <h2>Outreach</h2>
            <DraftButton id={lead.id} hasDrafts={lead.drafts.length > 0} />
          </div>
          <p className="muted small">
            Arclight never sends anything. Review each message, then send it yourself.
          </p>
          {!lead.doNotContact &&
            lead.drafts.map((d) => <DraftCard key={d.id} draft={d} contacts={contacts} />)}
        </section>
      )}

      <section className="card feedback">
        <h2>Is this a good lead?</h2>
        <p className="muted small">
          Your ratings show which signals predict good leads (Settings → Scoring).
        </p>
        <div className="actions">
          {(['good', 'bad'] as const).map((value) => (
            <form
              key={value}
              action={feedbackAction.bind(null, lead.id, lead.feedback === value ? null : value)}
            >
              <button
                type="submit"
                className={`button secondary${lead.feedback === value ? ' active' : ''}`}
              >
                {value === 'good' ? '👍 Good lead' : '👎 Not a fit'}
              </button>
            </form>
          ))}
          {lead.websiteUrl && !lead.doNotContact && (
            <form action={doNotContactAction.bind(null, lead.id, lead.websiteUrl)}>
              <button type="submit" className="button secondary">
                Do not contact
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Contact channels</h2>
        {contacts.length === 0 ? (
          <p className="muted">No contact channels published on the website.</p>
        ) : (
          <ul className="contacts">
            {contacts.map((c) => (
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
