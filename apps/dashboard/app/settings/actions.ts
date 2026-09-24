'use server';

import { revalidatePath } from 'next/cache';
import { getArclight } from '@/lib/arclight';

export interface ProfileState {
  message?: string;
  error?: string;
}

export async function saveProfileAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const arclight = await getArclight();
  if (!arclight) return { error: 'The dashboard is not connected to the Arclight API.' };
  const field = (name: string) => String(form.get(name) ?? '').trim();

  const { error } = await arclight.PATCH('/agency-profile', {
    body: {
      agencyName: field('agencyName'),
      senderName: field('senderName'),
      services: field('services'),
      tone: field('tone'),
      language: field('language') || 'id',
    },
  });
  if (error) return { error: error.error.message };
  revalidatePath('/settings');
  return { message: 'Saved.' };
}

export async function addDoNotContactAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const arclight = await getArclight();
  if (!arclight) return { error: 'The dashboard is not connected to the Arclight API.' };
  const kind = String(form.get('kind')) as 'domain' | 'email' | 'phone';
  const { error } = await arclight.POST('/do-not-contact', {
    body: {
      kind,
      value: String(form.get('value') ?? ''),
      reason: String(form.get('reason') ?? '') || undefined,
    },
  });
  if (error) return { error: error.error.message };
  revalidatePath('/settings');
  return { message: 'Added.' };
}

export async function removeDoNotContactAction(id: string): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  await arclight.DELETE('/do-not-contact/{id}', { params: { path: { id } } });
  revalidatePath('/settings');
}

export async function saveWeightsAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const arclight = await getArclight();
  if (!arclight) return { error: 'The dashboard is not connected to the Arclight API.' };
  const weights: Record<string, number> = {};
  for (const [name, value] of form.entries()) {
    if (!name.startsWith('weight:')) continue;
    const key = name.slice('weight:'.length);
    const points = Number(value);
    if (String(value) !== String(form.get(`default:${key}`)) && Number.isInteger(points)) {
      weights[key] = Math.max(0, Math.min(100, points));
    }
  }
  const { error } = await arclight.PUT('/scoring/weights', { body: { weights } });
  if (error) return { error: error.error.message };
  revalidatePath('/settings');
  revalidatePath('/');
  return { message: 'Saved. All scores were recalculated.' };
}
