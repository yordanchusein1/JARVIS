import Link from 'next/link';
import { getJarvis } from '@/lib/jarvis';
import { AutoRefresh } from './auto-refresh';
import { AuditStatus, isAuditPending, Score } from './components';
import { TrackForm } from './track-form';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const jarvis = getJarvis();
  if (!jarvis) {
    return (
      <div className="card">
        <h1>Connect the dashboard</h1>
        <p>
          Set <code>JARVIS_API_URL</code> and <code>JARVIS_API_KEY</code>. Create a key with{' '}
          <code>pnpm api-key:create dashboard</code>.
        </p>
      </div>
    );
  }

  const { data, error } = await jarvis.GET('/businesses', { params: { query: { limit: 100 } } });
  const leads = data?.data ?? [];

  return (
    <>
      <AutoRefresh active={leads.some((b) => isAuditPending(b.latestAudit))} />
      <h1>Leads</h1>
      <TrackForm />
      {error || !data ? (
        <p className="error">Could not load leads: {error?.error.message ?? 'API unreachable'}</p>
      ) : leads.length === 0 ? (
        <p className="muted">No leads yet. Add a prospect&apos;s website above.</p>
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
              </tr>
            </thead>
            <tbody>
              {leads.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/leads/${b.id}`} className="lead-link">
                      {b.displayName ?? b.websiteUrl ?? 'Unnamed business'}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
