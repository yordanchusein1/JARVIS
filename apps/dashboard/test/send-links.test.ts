import { describe, expect, it } from 'vitest';
import { sendLinks } from '@arclight/sdk';

const draft = (channel: 'whatsapp' | 'email') => ({
  id: '00000000-0000-4000-8000-000000000000',
  channel,
  subject: channel === 'email' ? 'Website Anda' : null,
  body: 'Halo & salam, apa kabar?',
  warnings: [],
  model: 'm',
  createdAt: '2026-09-25T00:00:00.000Z',
});

describe('sendLinks', () => {
  const contacts = [
    { kind: 'whatsapp' as const, value: '+62 812-3456-7890' },
    { kind: 'email' as const, value: 'info@klinik.co.id' },
    { kind: 'instagram' as const, value: 'https://instagram.com/klinik' },
  ];

  it('opens WhatsApp with the draft filled in', () => {
    expect(sendLinks(draft('whatsapp'), contacts)).toEqual([
      {
        channel: 'whatsapp',
        to: '+62 812-3456-7890',
        label: 'Open WhatsApp (+62 812-3456-7890)',
        href: 'https://wa.me/6281234567890?text=Halo%20%26%20salam%2C%20apa%20kabar%3F',
      },
    ]);
  });

  it('opens the email program with subject and body filled in', () => {
    expect(sendLinks(draft('email'), contacts)[0]?.href).toBe(
      'mailto:info@klinik.co.id?subject=Website%20Anda&body=Halo%20%26%20salam%2C%20apa%20kabar%3F',
    );
  });

  it('offers nothing without a matching contact', () => {
    expect(sendLinks(draft('email'), [contacts[0]!])).toEqual([]);
  });
});
