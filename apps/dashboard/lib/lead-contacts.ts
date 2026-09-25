import 'server-only';
import type { ArclightClient, components } from '@arclight/sdk';

type Lead = components['schemas']['BusinessDetail'];
type Contact = components['schemas']['Contact'];

/**
 * A lead's contact channels, plus the phone number listed on Google Maps when the business
 * publishes none itself. The Google number is fetched live and never stored (Google's terms).
 */
export async function contactsWithGooglePhone(
  arclight: ArclightClient,
  lead: Lead,
): Promise<{ contacts: Contact[]; place: components['schemas']['Place'] | undefined }> {
  const place = lead.placeId
    ? (await arclight.GET('/businesses/{id}/place', { params: { path: { id: lead.id } } })).data
    : undefined;
  const contacts =
    place?.phone &&
    !lead.doNotContact &&
    !lead.contacts.some((c) => c.kind === 'phone' || c.kind === 'whatsapp')
      ? [...lead.contacts, { kind: 'phone' as const, value: place.phone, sourceUrl: place.mapsUrl }]
      : lead.contacts;
  return { contacts, place };
}
