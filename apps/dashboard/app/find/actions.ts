'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getJarvis } from '@/lib/jarvis';

export async function trackPlacesAction(form: FormData): Promise<void> {
  const jarvis = getJarvis();
  if (!jarvis) throw new Error('The dashboard is not connected to the JARVIS API.');
  const placeIds = form.getAll('placeId').map(String).filter(Boolean);
  if (placeIds.length === 0) redirect(`/find?q=${encodeURIComponent(String(form.get('q') ?? ''))}`);

  const { error } = await jarvis.POST('/businesses/places', { body: { placeIds } });
  if (error) throw new Error(error.error.message);
  revalidatePath('/');
  redirect('/');
}
