import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAgencyProfile, missingProfileFields, updateAgencyProfile } from '../src/agency.ts';
import { setLeadStatus, trackWebsites } from '../src/businesses.ts';
import { audits, signals } from '../src/db/schema.ts';
import {
  createClaudeDraftWriter,
  DraftingNotReadyError,
  generateDrafts,
  latestDrafts,
  unsupportedNumbers,
  type DraftRequest,
  type DraftWriter,
} from '../src/drafting.ts';
import { setupTestDatabase } from './db.ts';

const database = await setupTestDatabase();
const { db } = database;

beforeEach(() => database.reset());
afterAll(() => database.close());

const PROFILE = {
  agencyName: 'Vera & Co',
  senderName: 'Yordan',
  services: 'Website design and development',
  tone: 'friendly and professional',
  language: 'id',
};

async function auditedLead() {
  const { createdIds } = await trackWebsites(db, ['klinik.co.id']);
  const businessId = createdIds[0]!;
  const [audit] = await db
    .insert(audits)
    .values({ businessId, status: 'succeeded', needScore: 60, capacityScore: 40 })
    .returning();
  await db.insert(signals).values([
    {
      auditId: audit!.id,
      axis: 'need',
      key: 'slow_mobile',
      points: 25,
      evidence: 'Google PageSpeed Insights rates the mobile performance 34/100.',
    },
    {
      auditId: audit!.id,
      axis: 'capacity',
      key: 'careers_page',
      points: 20,
      evidence: 'Has a careers page ("Karir"), so it is hiring.',
    },
  ]);
  return businessId;
}

describe('unsupportedNumbers', () => {
  it('flags numbers that are not in the evidence', () => {
    const sources = ['Mobile performance 34/100.', 'Main content takes 8.9 s to appear.'];
    expect(unsupportedNumbers('Skor 34 dari 100, muncul dalam 8,9 detik.', sources)).toEqual([]);
    expect(unsupportedNumbers('53% pengunjung pergi dan omzet naik 200%', sources)).toEqual([
      '53',
      '200',
    ]);
    expect(unsupportedNumbers('Boleh minta waktu 15 menit?', sources)).toEqual([]);
  });
});

describe('agency profile', () => {
  it('starts empty and can be updated', async () => {
    expect(missingProfileFields(await getAgencyProfile(db))).toEqual([
      'agencyName',
      'senderName',
      'services',
    ]);
    await updateAgencyProfile(db, PROFILE);
    await updateAgencyProfile(db, { tone: 'santai' });
    const profile = await getAgencyProfile(db);
    expect(profile).toMatchObject({ ...PROFILE, tone: 'santai' });
    expect(missingProfileFields(profile)).toEqual([]);
  });
});

describe('generateDrafts', () => {
  const requests: DraftRequest[] = [];
  const writer: DraftWriter = async (request) => {
    requests.push(request);
    return {
      whatsapp: 'Halo, skor performa mobile website Anda 34/100. Boleh saya kirim review gratis?',
      emailSubject: 'Website klinik di HP',
      emailBody: 'Skor 34/100. 53% pengunjung pergi.',
      model: 'test-model',
    };
  };

  it('needs a complete profile and a successful audit', async () => {
    const businessId = await auditedLead();
    await expect(generateDrafts(db, businessId, writer)).rejects.toThrow(/agency profile/);

    await updateAgencyProfile(db, PROFILE);
    await db.update(audits).set({ status: 'running' }).where(eq(audits.businessId, businessId));
    await expect(generateDrafts(db, businessId, writer)).rejects.toBeInstanceOf(
      DraftingNotReadyError,
    );
  });

  it('writes drafts from the evidence and warns about unsupported numbers', async () => {
    const businessId = await auditedLead();
    await updateAgencyProfile(db, PROFILE);

    await generateDrafts(db, businessId, writer);

    expect(requests.at(-1)?.evidence).toEqual([
      { axis: 'need', text: 'Google PageSpeed Insights rates the mobile performance 34/100.' },
      { axis: 'capacity', text: 'Has a careers page ("Karir"), so it is hiring.' },
    ]);
    const saved = await latestDrafts(db, businessId);
    expect(saved.map((d) => [d.channel, d.subject, d.warnings.length])).toEqual([
      ['whatsapp', null, 0],
      ['email', 'Website klinik di HP', 1],
    ]);
    expect(saved[1]?.warnings[0]).toContain('"53"');
  });
});

describe('createClaudeDraftWriter', () => {
  it('asks Claude for structured output with fallbacks and parses the reply', async () => {
    let body: Record<string, unknown> = {};
    let headers = new Headers();
    const client = new Anthropic({
      apiKey: 'test-key',
      maxRetries: 0,
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        headers = new Headers(init?.headers);
        const draft = { whatsapp: 'Halo', emailSubject: 'Subjek', emailBody: 'Isi' };
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5',
            content: [{ type: 'text', text: JSON.stringify(draft) }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    });

    const result = await createClaudeDraftWriter({ client })({
      agency: PROFILE,
      business: { name: 'Klinik', websiteUrl: 'https://klinik.co.id/' },
      evidence: [{ axis: 'need', text: 'No HTTPS.' }],
    });

    expect(result).toEqual({
      whatsapp: 'Halo',
      emailSubject: 'Subjek',
      emailBody: 'Isi',
      model: 'claude-opus-5',
    });
    expect(body).toMatchObject({ model: 'claude-opus-5', fallbacks: 'default' });
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(JSON.stringify(body.messages)).toContain('No HTTPS.');
  });
});

describe('setLeadStatus', () => {
  it('updates the pipeline status', async () => {
    const businessId = await auditedLead();
    expect((await setLeadStatus(db, businessId, 'contacted'))?.status).toBe('contacted');
    expect(await setLeadStatus(db, '00000000-0000-4000-8000-000000000000', 'won')).toBeNull();
  });
});
