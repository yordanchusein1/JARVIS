'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getArclight } from '@/lib/arclight';

export async function trackPlacesAction(form: FormData): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  const placeIds = form.getAll('placeId').map(String).filter(Boolean);
  if (placeIds.length === 0) redirect(`/find?q=${encodeURIComponent(String(form.get('q') ?? ''))}`);

  const { error } = await arclight.POST('/businesses/places', { body: { placeIds } });
  if (error) throw new Error(error.error.message);
  revalidatePath('/');
  redirect('/');
}
