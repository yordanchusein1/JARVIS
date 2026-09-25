import type { components } from './schema.d.ts';

type Draft = components['schemas']['Draft'];
type Contact = Pick<components['schemas']['Contact'], 'kind' | 'value'>;

export interface SendLink {
  channel: Draft['channel'];
  /** The phone number or email address the link opens. */
  to: string;
  label: string;
  /** A `https://wa.me/…` or `mailto:` link with the draft filled in. */
  href: string;
}

/**
 * Links that open WhatsApp or an email program with a draft filled in, one per matching contact.
 * Arclight never sends messages; the person reviews the draft and presses send.
 */
export function sendLinks(draft: Draft, contacts: Contact[]): SendLink[] {
  if (draft.channel === 'whatsapp') {
    return contacts
      .filter((c) => c.kind === 'whatsapp' || c.kind === 'phone')
      .map((c) => ({
        channel: 'whatsapp',
        to: c.value,
        label: `Open WhatsApp (${c.value})`,
        href: `https://wa.me/${c.value.replace(/\D/g, '')}?text=${encodeURIComponent(draft.body)}`,
      }));
  }
  return contacts
    .filter((c) => c.kind === 'email')
    .map((c) => ({
      channel: 'email',
      to: c.value,
      label: `Open email to ${c.value}`,
      href: `mailto:${c.value}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.body)}`,
    }));
}
