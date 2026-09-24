'use server';

import { revalidatePath } from 'next/cache';
import { getJarvis } from '@/lib/jarvis';

export async function reauditAction(id: string): Promise<void> {
  const jarvis = getJarvis();
  if (!jarvis) throw new Error('The dashboard is not connected to the JARVIS API.');
  const { error } = await jarvis.POST('/businesses/{id}/audits', { params: { path: { id } } });
  if (error) throw new Error(error.error.message);
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}

export async function draftAction(id: string): Promise<{ error?: string }> {
  const jarvis = getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };
  const { error } = await jarvis.POST('/businesses/{id}/drafts', { params: { path: { id } } });
  if (error) return { error: error.error.message };
  revalidatePath(`/leads/${id}`);
  return {};
}

export async function statusAction(id: string, form: FormData): Promise<void> {
  const jarvis = getJarvis();
  if (!jarvis) throw new Error('The dashboard is not connected to the JARVIS API.');
  const status = String(form.get('status')) as 'new';
  const { error } = await jarvis.PATCH('/businesses/{id}', {
    params: { path: { id } },
    body: { status },
  });
  if (error) throw new Error(error.error.message);
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
}
