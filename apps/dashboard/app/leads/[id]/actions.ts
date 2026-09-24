'use server';

import { revalidatePath } from 'next/cache';
import { getArclight } from '@/lib/arclight';

export async function reauditAction(id: string): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  const { error } = await arclight.POST('/businesses/{id}/audits', { params: { path: { id } } });
  if (error) throw new Error(error.error.message);
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}

export async function draftAction(id: string): Promise<{ error?: string }> {
  const arclight = await getArclight();
  if (!arclight) return { error: 'The dashboard is not connected to the Arclight API.' };
  const { error } = await arclight.POST('/businesses/{id}/drafts', { params: { path: { id } } });
  if (error) return { error: error.error.message };
  revalidatePath(`/leads/${id}`);
  return {};
}

export async function statusAction(id: string, form: FormData): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  const status = String(form.get('status')) as 'new';
  const { error } = await arclight.PATCH('/businesses/{id}', {
    params: { path: { id } },
    body: { status },
  });
  if (error) throw new Error(error.error.message);
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}

export async function feedbackAction(id: string, feedback: 'good' | 'bad' | null): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  const { error } = await arclight.PATCH('/businesses/{id}', {
    params: { path: { id } },
    body: { feedback },
  });
  if (error) throw new Error(error.error.message);
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}

/** Adds the lead's website domain to the do-not-contact list and marks the lead as lost. */
export async function doNotContactAction(id: string, website: string): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error('The dashboard is not connected to the Arclight API.');
  const added = await arclight.POST('/do-not-contact', {
    body: { kind: 'domain', value: website, reason: 'Marked from the lead page' },
  });
  if (added.error) throw new Error(added.error.error.message);
  await arclight.PATCH('/businesses/{id}', { params: { path: { id } }, body: { status: 'lost' } });
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}
