import Link from 'next/link';
import { getArclight } from '@/lib/arclight';
import { contactsWithGooglePhone } from '@/lib/lead-contacts';
import { sendLinks, type SendLink } from '@/lib/send-links';
import { AutoRefresh } from './auto-refresh';
import { BriefingPanel } from './briefing';
import { AuditStatus, isAuditPending, Score } from './components';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const arclight = await getArclight();
  if (!arclight) {
    return (
      <div className="card">
        <h1>Connect the dashboard</h1>
        <p>
          Set <code>ARCLIGHT_API_URL</code> and <code>ARCLIGHT_API_KEY</code>. Create a key with{' '}
          <code>pnpm api-key:create dashboard</code>.
        </p>
      </div>
    );
  }

  const [{ data, error }, briefing, profile, hunts] = await Promise.all([
    arclight.GET('/businesses', { params: { query: { limit: 100 } } }),
    arclight.GET('/briefing'),
    arclight.GET('/agency-profile'),
    arclight.GET('/hunts'),
  ]);
  const leads = data?.data ?? [];

  // WhatsApp and email links with the drafts filled in, for the leads that are ready to send.
  const sendOptions: Record<string, SendLink[]> = {};
  await Promise.all(
    (briefing.data?.readyToSend ?? []).map(async ({ id }) => {
      const { data: lead } = await arclight.GET('/businesses/{id}', { params: { path: { id } } });
      if (!lead || lead.doNotContact) return;
      const { contacts } = await contactsWithGooglePhone(arclight, lead);
      sendOptions[id] = lead.drafts.flatMap((d) => sendLinks(d, contacts).slice(0, 1));
    }),
  );

  return (
    <>
      <AutoRefresh active={leads.some((b) => isAuditPending(b.latestAudit))} />
      {briefing.data && profile.data && (
        <BriefingPanel
          briefing={briefing.data}
          timeZone={profile.data.timezone}
          senderName={profile.data.senderName}
          hasHunts={(hunts.data?.data.length ?? 0) > 0}
          sendOptions={sendOptions}
        />
      )}
      <div className="section-header">
        <h1>Leads</h1>
        <Link href="/find" className="button">
          Add prospects
        </Link>
      </div>
      {error || !data ? (
        <p className="error">Could not load leads: {error?.error.message ?? 'API unreachable'}</p>
      ) : leads.length === 0 ? (
        <p className="muted">
          No leads yet. <Link href="/find">Find prospects</Link> or{' '}
          <Link href="/hunts">set up a hunt</Link>.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Business</th>
                <th className="num">Priority</th>
                <th className="num">Need</th>
                <th className="num">Capacity</th>
                <th>Audit</th>
                <th>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/leads/${b.id}`} className="lead-link">
                      {b.displayName ??
                        b.websiteUrl ??
                        (b.placeId ? 'Google Maps business' : 'Unnamed business')}
                    </Link>
                    {b.displayName && b.websiteUrl && (
                      <div className="muted small">{b.websiteUrl}</div>
                    )}
                  </td>
                  <td className="num">
                    <Score value={b.priority} label="Priority" />
                  </td>
                  <td className="num">
                    <Score value={b.latestAudit?.needScore ?? null} label="Need" />
                  </td>
                  <td className="num">
                    <Score value={b.latestAudit?.capacityScore ?? null} label="Capacity" />
                  </td>
                  <td>
                    <AuditStatus audit={b.latestAudit} />
                  </td>
                  <td className="muted">
                    {b.status}
                    {b.feedback === 'good' ? ' 👍' : b.feedback === 'bad' ? ' 👎' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
