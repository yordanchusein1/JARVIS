'use server';

import { revalidatePath } from 'next/cache';
import { getJarvis } from '@/lib/jarvis';

export interface ProfileState {
  message?: string;
  error?: string;
}

export async function saveProfileAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const jarvis = getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };
  const field = (name: string) => String(form.get(name) ?? '').trim();

  const { error } = await jarvis.PATCH('/agency-profile', {
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
  const jarvis = getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };
  const kind = String(form.get('kind')) as 'domain' | 'email' | 'phone';
  const { error } = await jarvis.POST('/do-not-contact', {
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
  const jarvis = getJarvis();
  if (!jarvis) throw new Error('The dashboard is not connected to the JARVIS API.');
  await jarvis.DELETE('/do-not-contact/{id}', { params: { path: { id } } });
  revalidatePath('/settings');
}

export async function saveWeightsAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const jarvis = getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };
  const weights: Record<string, number> = {};
  for (const [name, value] of form.entries()) {
    if (!name.startsWith('weight:')) continue;
    const key = name.slice('weight:'.length);
    const points = Number(value);
    if (String(value) !== String(form.get(`default:${key}`)) && Number.isInteger(points)) {
      weights[key] = Math.max(0, Math.min(100, points));
    }
  }
  const { error } = await jarvis.PUT('/scoring/weights', { body: { weights } });
  if (error) return { error: error.error.message };
  revalidatePath('/settings');
  revalidatePath('/');
  return { message: 'Saved. All scores were recalculated.' };
}
