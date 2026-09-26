import type { Hunt } from '@arclighthq/sdk';
import { getArclight } from '@/lib/arclight';
import { formatWhen, hourLabel } from '@/lib/format';
import {
  deleteHuntAction,
  runHuntAction,
  setAutomationPausedAction,
  setHuntActiveAction,
} from './actions';
import { HuntForm, PendingButton } from './hunt-form';

export const dynamic = 'force-dynamic';

function describe(hunt: Hunt): string {
  return [
    `Daily at ${hourLabel(hunt.runHour)}`,
    `up to ${hunt.maxNewPerRun} new ${hunt.maxNewPerRun === 1 ? 'lead' : 'leads'}`,
    hunt.minReviews > 0 && `at least ${hunt.minReviews} reviews`,
    !hunt.includeNoWebsite && 'only with a website',
    hunt.autoDraft && `drafts for priority ${hunt.autoDraftMinPriority}+`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function LastRun({ hunt, timeZone }: { hunt: Hunt; timeZone: string }) {
  const run = hunt.lastRun;
  if (!run) return <p className="muted small">Not run yet.</p>;
  const when = formatWhen(run.startedAt, timeZone);
  if (run.status === 'failed') {
    return (
      <p className="error small">
        {when}: the run failed. {run.error}
      </p>
    );
  }
  if (run.status === 'running') return <p className="muted small">{when}: running…</p>;
  return (
    <>
      <p className="small">
        {when}: <strong>{run.tracked} new</strong> of {run.found} found
        <span className="muted">
          {' '}
          ({run.alreadyTracked} already leads, {run.excluded} filtered out)
        </span>
      </p>
      {run.found > 0 && run.tracked === 0 && run.alreadyTracked + run.excluded === run.found && (
        <p className="muted small">
          Nothing new left in this search. Try another area or business type, or loosen the filters.
        </p>
      )}
    </>
  );
}

export default async function HuntsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  const arclight = await getArclight();
  if (!arclight) {
    return <p className="error">The dashboard is not connected to the Arclight API.</p>;
  }
  const [{ data, error }, profile] = await Promise.all([
    arclight.GET('/hunts'),
    arclight.GET('/agency-profile'),
  ]);
  const timeZone = profile.data?.timezone ?? 'UTC';
  const hunts = data?.data ?? [];
  const paused = profile.data?.automationPaused ?? false;

  return (
    <>
      <h1>Hunts</h1>
      <p className="muted">
        A hunt is a Google Maps search that Arclight runs every day on its own. It adds the
        most-reviewed businesses it hasn&apos;t seen before as leads and audits them, so new leads
        are waiting for you each morning. Nothing is ever sent.
      </p>

      <section className="card">
        <div className="section-header">
          <h2>Automatic hunts</h2>
          <span className={paused ? 'badge' : 'badge badge-succeeded'}>
            {paused ? 'Stopped' : 'On'}
          </span>
        </div>
        <p className="muted small">
          {paused
            ? 'Scheduled hunts are stopped, so no Google searches or audits run on their own. You can still search, run a hunt and audit leads yourself. Missed runs are skipped when you turn this back on.'
            : 'Active hunts run every day at their hour. Turn this off to stop all of them at once and save on Google, AI and server costs.'}
        </p>
        <form action={setAutomationPausedAction.bind(null, !paused)}>
          <PendingButton secondary={!paused} pendingText="Saving…">
            {paused ? 'Turn on automatic hunts' : 'Stop automatic hunts'}
          </PendingButton>
        </form>
      </section>

      {error && <p className="error">Could not load hunts: {error.error.message}</p>}

      {hunts.map((hunt) => (
        <section key={hunt.id} className="card hunt">
          <div className="section-header">
            <h2>{hunt.query}</h2>
            <span className={hunt.active ? 'badge badge-succeeded' : 'badge'}>
              {hunt.active ? 'Active' : 'Paused'}
            </span>
          </div>
          <p className="muted small">{describe(hunt)}</p>
          <LastRun hunt={hunt} timeZone={timeZone} />
          <p className="small">
            {hunt.leads} {hunt.leads === 1 ? 'lead' : 'leads'} found so far
            {hunt.nextRunAt && (
              <span className="muted"> · next run {formatWhen(hunt.nextRunAt, timeZone)}</span>
            )}
          </p>

          <div className="actions">
            <form action={runHuntAction.bind(null, hunt.id)}>
              <PendingButton pendingText="Searching…">Run now</PendingButton>
            </form>
            <form action={setHuntActiveAction.bind(null, hunt.id, !hunt.active)}>
              <PendingButton secondary pendingText="Saving…">
                {hunt.active ? 'Pause' : 'Resume'}
              </PendingButton>
            </form>
            <form action={deleteHuntAction.bind(null, hunt.id)}>
              <PendingButton
                secondary
                pendingText="Deleting…"
                confirmText={`Delete the hunt "${hunt.query}"? The leads it found stay.`}
              >
                Delete
              </PendingButton>
            </form>
          </div>

          <details>
            <summary className="small">Edit</summary>
            <HuntForm
              key={[
                hunt.query,
                hunt.runHour,
                hunt.maxNewPerRun,
                hunt.minReviews,
                hunt.includeNoWebsite,
                hunt.autoDraft,
                hunt.autoDraftMinPriority,
              ].join('|')}
              hunt={hunt}
              timeZone={timeZone}
            />
          </details>
        </section>
      ))}

      <section className="card" id="new">
        <h2>New hunt</h2>
        <HuntForm timeZone={timeZone} initialQuery={query} />
      </section>
    </>
  );
}
