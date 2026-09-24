import Link from 'next/link';
import { getArclight } from '@/lib/arclight';
import { AutoRefresh } from './auto-refresh';
import { AuditStatus, isAuditPending, Score } from './components';
import { CsvForm } from './csv-form';
import { TrackForm } from './track-form';

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

  const { data, error } = await arclight.GET('/businesses', { params: { query: { limit: 100 } } });
  const leads = data?.data ?? [];

  return (
    <>
      <AutoRefresh active={leads.some((b) => isAuditPending(b.latestAudit))} />
      <div className="section-header">
        <h1>Leads</h1>
        <Link href="/find" className="button">
          Find prospects on Google
        </Link>
      </div>
      <div className="columns">
        <TrackForm />
        <CsvForm />
      </div>
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
