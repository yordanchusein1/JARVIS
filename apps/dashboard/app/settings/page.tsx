import { getArclight } from '@/lib/arclight';
import { removeDoNotContactAction } from './actions';
import { DoNotContactForm, WeightsForm } from './lists';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const arclight = await getArclight();
  if (!arclight)
    return <p className="error">The dashboard is not connected to the Arclight API.</p>;
  const [{ data, error }, dnc, insights] = await Promise.all([
    arclight.GET('/agency-profile'),
    arclight.GET('/do-not-contact'),
    arclight.GET('/scoring/signals'),
  ]);
  if (!data) return <p className="error">Could not load the profile: {error?.error.message}</p>;

  return (
    <>
      <h1>Agency profile</h1>
      <p className="muted">
        Arclight writes outreach in your agency&apos;s name and voice using this profile.
      </p>
      <ProfileForm profile={data} />

      <h1>Do not contact</h1>
      <p className="muted">
        Businesses that asked not to be contacted. Arclight never tracks, shows or writes messages
        for them.
      </p>
      <section className="card">
        <DoNotContactForm />
        {(dnc.data?.data ?? []).length > 0 && (
          <ul className="contacts">
            {dnc.data!.data.map((e) => (
              <li key={e.id}>
                <span className="muted small">{e.kind}</span>
                <span className="actions">
                  <span>
                    {e.value}
                    {e.reason && <span className="muted small"> · {e.reason}</span>}
                  </span>
                  <form action={removeDoNotContactAction.bind(null, e.id)}>
                    <button type="submit" className="button secondary">
                      Remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h1>Scoring</h1>
      <p className="muted">
        Points each signal adds to a lead&apos;s need or capacity score. Rate leads 👍 or 👎 on
        their page; signals that appear mostly on 👎 leads deserve fewer points.
      </p>
      {(insights.data?.data ?? []).length === 0 ? (
        <p className="muted">No audited leads yet.</p>
      ) : (
        <WeightsForm insights={insights.data!.data} />
      )}
    </>
  );
}
