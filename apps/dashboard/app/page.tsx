import { getJarvis } from '@/lib/jarvis';
import { TrackForm } from './track-form';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

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

  return (
    <>
      <h1>Leads</h1>
      <TrackForm />
      {error || !data ? (
        <p className="error">Could not load leads: {error?.error.message ?? 'API unreachable'}</p>
      ) : data.data.length === 0 ? (
        <p className="muted">No leads yet. Add a prospect&apos;s website above.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Website</th>
              <th>Status</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.websiteUrl ? (
                    <a href={b.websiteUrl} target="_blank" rel="noreferrer noopener">
                      {b.displayName ?? b.websiteUrl}
                    </a>
                  ) : (
                    (b.displayName ?? '—')
                  )}
                </td>
                <td>
                  <span className="badge">{b.status}</span>
                </td>
                <td className="muted">{dateFormat.format(new Date(b.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
