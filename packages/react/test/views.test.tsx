import { renderToStaticMarkup } from 'react-dom/server';
import type { Briefing, Business, BusinessDetail } from '@arclighthq/sdk';
import { describe, expect, it } from 'vitest';
import { BriefingView, LeadDetailView, LeadListView, PipelineView } from '../src/views.tsx';

const lead: Business = {
  id: 'a1',
  source: 'url',
  placeId: null,
  huntId: null,
  websiteUrl: 'https://klinik.co.id/',
  displayName: 'Klinik Gigi Senyum',
  status: 'new',
  feedback: null,
  priority: 87,
  latestAudit: {
    id: 'au1',
    status: 'succeeded',
    needScore: 100,
    capacityScore: 75,
    error: null,
    notes: [],
    createdAt: '2026-09-25T00:00:00.000Z',
    finishedAt: '2026-09-25T00:01:00.000Z',
  },
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
};
const href = (id: string) => `/admin/leads/${id}`;

describe('views', () => {
  it('lists leads with scores and links to the host app', () => {
    const html = renderToStaticMarkup(<LeadListView leads={[lead]} leadHref={href} />);
    expect(html).toContain('href="/admin/leads/a1"');
    expect(html).toContain('Klinik Gigi Senyum');
    expect(html).toContain('arc-score-high');
    expect(html).toContain('Audited');
  });

  it('shows the briefing with send buttons', () => {
    const briefing: Briefing = {
      since: '2026-09-24T00:00:00.000Z',
      until: '2026-09-25T00:00:00.000Z',
      newLeads: 3,
      audited: 3,
      auditsFailed: 0,
      draftsWritten: 1,
      topNewLeads: [lead],
      readyToSend: [lead],
      readyToSendTotal: 1,
      followUps: [],
      followUpsTotal: 0,
      huntRuns: [],
      pipeline: { new: 3, contacted: 0, replied: 0, meeting: 0, won: 0, lost: 0 },
    };
    const html = renderToStaticMarkup(
      <BriefingView
        briefing={briefing}
        leadHref={() => null}
        sendOptions={{
          a1: [
            {
              channel: 'whatsapp',
              to: '+62812',
              label: 'Open WhatsApp',
              href: 'https://wa.me/62812?text=Halo',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('Send on WhatsApp');
    expect(html).toContain('href="https://wa.me/62812?text=Halo"');
    expect(html).not.toContain('<a class="arc-lead-link"');
  });

  it('groups the pipeline by status', () => {
    const html = renderToStaticMarkup(
      <PipelineView
        leads={[lead, { ...lead, id: 'a2', status: 'won' }]}
        leadHref={href}
        onMove={() => {}}
      />,
    );
    expect(html.match(/arc-pipeline-column/g)).toHaveLength(6);
    expect(html).toMatch(/Won <span class="arc-muted">1<\/span>/);
  });

  it('shows a lead with evidence and drafts, and refuses to draft for do-not-contact leads', () => {
    const detail: BusinessDetail = {
      ...lead,
      signals: [
        { axis: 'need', key: 'no_https', points: 25, evidence: 'The website does not use HTTPS.' },
      ],
      contacts: [],
      drafts: [
        {
          id: 'd1',
          channel: 'email',
          subject: 'Website',
          body: 'Halo',
          warnings: ['Check "200"'],
          model: 'm',
          createdAt: '',
        },
      ],
      doNotContact: false,
    };
    const props = {
      sendLinksFor: () => [],
      onWriteDrafts: () => {},
      onStatus: () => {},
      onReaudit: () => {},
    };
    const html = renderToStaticMarkup(<LeadDetailView lead={detail} {...props} />);
    expect(html).toContain('The website does not use HTTPS.');
    expect(html).toContain('Write new drafts');
    expect(html).toContain('⚠ Check');
    const blocked = renderToStaticMarkup(
      <LeadDetailView lead={{ ...detail, doNotContact: true }} {...props} />,
    );
    expect(blocked).toContain('do-not-contact');
    expect(blocked).not.toContain('Write new drafts');
  });
});
