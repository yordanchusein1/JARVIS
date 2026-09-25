import type { components } from '@arclight/sdk';

type Draft = components['schemas']['Draft'];
type Contact = Pick<components['schemas']['Contact'], 'kind' | 'value'>;

export interface SendLink {
  channel: Draft['channel'];
  label: string;
  href: string;
}

/**
 * Links that open WhatsApp or the email program with a draft filled in. Arclight never sends;
 * the person presses send.
 */
export function sendLinks(draft: Draft, contacts: Contact[]): SendLink[] {
  if (draft.channel === 'whatsapp') {
    return contacts
      .filter((c) => c.kind === 'whatsapp' || c.kind === 'phone')
      .map((c) => ({
        channel: 'whatsapp',
        label: `Open WhatsApp (${c.value})`,
        href: `https://wa.me/${c.value.replace(/\D/g, '')}?text=${encodeURIComponent(draft.body)}`,
      }));
  }
  return contacts
    .filter((c) => c.kind === 'email')
    .map((c) => ({
      channel: 'email',
      label: `Open email to ${c.value}`,
      href: `mailto:${c.value}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.body)}`,
    }));
}
