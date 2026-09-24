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
