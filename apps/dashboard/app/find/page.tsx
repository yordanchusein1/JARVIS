import Link from 'next/link';
import { getArclight } from '@/lib/arclight';
import { trackPlacesAction } from './actions';
import { CsvForm } from './csv-form';
import { TrackForm } from './track-form';

export const dynamic = 'force-dynamic';

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const arclight = await getArclight();
  if (!arclight)
    return <p className="error">The dashboard is not connected to the Arclight API.</p>;

  const query = q.trim();
  const result =
    query.length >= 2
      ? await arclight.GET('/places/search', { params: { query: { q: query } } })
      : null;
  const places = result?.data?.data ?? [];

  return (
    <>
      <h1>Find prospects</h1>
      <form className="card search" action="/find">
        <label className="label" htmlFor="q">
          Business type and place
        </label>
        <div className="actions">
          <input
            className="input grow"
            id="q"
            name="q"
            defaultValue={query}
            placeholder="klinik gigi Surabaya"
            minLength={2}
            required
          />
          <button type="submit" className="button">
            Search Google
          </button>
        </div>
        <p className="muted small">
          Results come live from Google Maps. Arclight stores only the Google place ID of the
          businesses you pick, as Google&apos;s terms require.
        </p>
      </form>

      {result?.error && <p className="error">{result.error.error.message}</p>}
      {query && result?.data && places.length === 0 && (
        <p className="muted">No businesses found.</p>
      )}
      {places.length > 0 && (
        <p className="muted small hint">
          Want Arclight to run this search every day on its own?{' '}
          <Link href={`/hunts?query=${encodeURIComponent(query)}#new`}>Turn it into a hunt</Link>.
        </p>
      )}

      {places.length > 0 && (
        <form action={trackPlacesAction}>
          <input type="hidden" name="q" value={query} />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Business</th>
                  <th className="num">Google rating</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <tr key={p.placeId}>
                    <td>
                      {p.businessId ? (
                        <span className="muted small">Tracked</span>
                      ) : (
                        <input
                          type="checkbox"
                          name="placeId"
                          value={p.placeId}
                          aria-label={`Track ${p.name}`}
                        />
                      )}
                    </td>
                    <td>
                      {p.businessId ? (
                        <Link href={`/leads/${p.businessId}`} className="lead-link">
                          {p.name}
                        </Link>
                      ) : (
                        <strong>{p.name}</strong>
                      )}
                      <div className="muted small">{p.address}</div>
                    </td>
                    <td className="num">
                      {p.rating !== null ? `${p.rating} ★ (${p.ratingCount ?? 0})` : '—'}
                    </td>
                    <td className="small">
                      {p.websiteUrl ? (
                        <a href={p.websiteUrl} target="_blank" rel="noreferrer noopener">
                          {new URL(p.websiteUrl).hostname.replace(/^www\./, '')}
                        </a>
                      ) : (
                        <span className="badge badge-failed">No website</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <button type="submit" className="button">
              Track selected businesses
            </button>
          </p>
        </form>
      )}

      <h2 className="section-title">Or add websites yourself</h2>
      <div className="columns">
        <TrackForm />
        <CsvForm />
      </div>
    </>
  );
}
