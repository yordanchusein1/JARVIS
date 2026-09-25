'use client';

import { useState } from 'react';
import {
  sendLinks,
  type ArclightClient,
  type BusinessDetail,
  type LeadStatus,
  type SendLink,
} from '@arclighthq/sdk';
import { useArclight, useArclightQuery } from './context.tsx';
import {
  BriefingView,
  isAuditPending,
  LeadDetailView,
  LeadListView,
  Notice,
  PipelineView,
} from './views.tsx';

/**
 * A lead's contacts plus the phone number listed on Google Maps when the business publishes none.
 * The Google number is fetched live and never stored (Google's terms).
 */
async function contactsOf(client: ArclightClient, lead: BusinessDetail) {
  let placeName: string | null = null;
  let contacts: { kind: BusinessDetail['contacts'][number]['kind']; value: string }[] =
    lead.contacts;
  if (lead.placeId) {
    const { data: place } = await client.GET('/businesses/{id}/place', {
      params: { path: { id: lead.id } },
    });
    placeName = place?.name ?? null;
    if (
      place?.phone &&
      !lead.doNotContact &&
      !contacts.some((c) => c.kind === 'phone' || c.kind === 'whatsapp')
    ) {
      contacts = [...contacts, { kind: 'phone', value: place.phone }];
    }
  }
  return { contacts: lead.doNotContact ? [] : contacts, placeName };
}

/** What Arclight did in the last day and what needs a person now, with one-click send buttons. */
export function Briefing({ title }: { title?: string }) {
  const { leadHref } = useArclight();
  const { data, error, loading } = useArclightQuery(async (client) => {
    const { data: briefing, error: failure } = await client.GET('/briefing');
    if (!briefing) return { error: failure };
    const sendOptions: Record<string, SendLink[]> = {};
    await Promise.all(
      briefing.readyToSend.map(async ({ id }) => {
        const { data: lead } = await client.GET('/businesses/{id}', { params: { path: { id } } });
        if (!lead) return;
        const { contacts } = await contactsOf(client, lead);
        sendOptions[id] = lead.drafts.flatMap((d) => sendLinks(d, contacts).slice(0, 1));
      }),
    );
    return { data: { briefing, sendOptions } };
  }, 'briefing');
  if (!data) return <Notice error={!!error}>{error ?? (loading ? 'Loading…' : '')}</Notice>;
  return (
    <BriefingView
      briefing={data.briefing}
      sendOptions={data.sendOptions}
      leadHref={leadHref}
      title={title}
    />
  );
}

/** Leads, highest priority first. Refreshes itself while audits run. */
export function LeadList({ limit = 50 }: { limit?: number }) {
  const { leadHref } = useArclight();
  const { data, error, loading } = useArclightQuery(
    (client) => client.GET('/businesses', { params: { query: { limit } } }),
    `leads:${limit}`,
    { shouldRefresh: (result) => result.data.some(isAuditPending) },
  );
  if (!data) return <Notice error={!!error}>{error ?? (loading ? 'Loading…' : '')}</Notice>;
  return <LeadListView leads={data.data} leadHref={leadHref} />;
}

/** Leads grouped by pipeline stage. Moving a lead updates it in Arclight. */
export function Pipeline() {
  const { client, leadHref } = useArclight();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const { data, error, loading, reload } = useArclightQuery(
    (c) => c.GET('/businesses', { params: { query: { limit: 100 } } }),
    'pipeline',
  );
  if (!data) return <Notice error={!!error}>{error ?? (loading ? 'Loading…' : '')}</Notice>;

  const move = async (id: string, status: LeadStatus) => {
    setBusyId(id);
    const { error: failure } = await client.PATCH('/businesses/{id}', {
      params: { path: { id } },
      body: { status },
    });
    setMoveError(failure ? failure.error.message : null);
    setBusyId(null);
    reload();
  };
  return (
    <>
      {moveError && <Notice error>{moveError}</Notice>}
      <PipelineView leads={data.data} leadHref={leadHref} onMove={move} busyId={busyId} />
    </>
  );
}

/**
 * One lead: its scores, the evidence behind them, drafts with send buttons, pipeline status and
 * actions. Refreshes itself while its audit runs.
 */
export function LeadDetail({ id }: { id: string }) {
  const { client } = useArclight();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useArclightQuery(
    async (c) => {
      const { data: lead, error: failure } = await c.GET('/businesses/{id}', {
        params: { path: { id } },
      });
      if (!lead) return { error: failure };
      return { data: { lead, ...(await contactsOf(c, lead)) } };
    },
    `lead:${id}`,
    { shouldRefresh: ({ lead }) => isAuditPending(lead) },
  );
  if (!data) return <Notice error={!!error}>{error ?? (loading ? 'Loading…' : '')}</Notice>;

  const act = async (action: () => Promise<{ error?: { error: { message: string } } }>) => {
    setBusy(true);
    setActionError(null);
    const { error: failure } = await action();
    if (failure) setActionError(failure.error.message);
    setBusy(false);
    reload();
  };
  const path = { params: { path: { id } } };

  return (
    <LeadDetailView
      lead={data.lead}
      placeName={data.placeName}
      busy={busy}
      error={actionError}
      sendLinksFor={(draftId) => {
        const draft = data.lead.drafts.find((d) => d.id === draftId);
        return draft ? sendLinks(draft, data.contacts) : [];
      }}
      onWriteDrafts={() => act(() => client.POST('/businesses/{id}/drafts', path))}
      onReaudit={() => act(() => client.POST('/businesses/{id}/audits', path))}
      onStatus={(status) =>
        act(() => client.PATCH('/businesses/{id}', { ...path, body: { status } }))
      }
    />
  );
}
