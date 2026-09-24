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
