'use server';

import { revalidatePath } from 'next/cache';
import { getJarvis } from '@/lib/jarvis';

export interface TrackState {
  message?: string;
  skipped?: { input: string; reason: string }[];
  error?: string;
}

export async function trackWebsitesAction(_prev: TrackState, form: FormData): Promise<TrackState> {
  const jarvis = await getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };

  const websites = String(form.get('websites') ?? '')
    .split(/[\s,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (websites.length === 0) return { error: 'Enter at least one website.' };
  if (websites.length > 100) return { error: 'Add at most 100 websites at a time.' };

  const { data, error } = await jarvis.POST('/businesses', { body: { websites } });
  if (!data) return { error: error?.error.message ?? 'Could not add the websites.' };

  revalidatePath('/');
  const existing = data.data.length - data.created;
  return {
    message: `Added ${data.created} new business${data.created === 1 ? '' : 'es'}${
      existing > 0 ? ` (${existing} already tracked)` : ''
    }.`,
    skipped: data.skipped,
  };
}

export async function importCsvAction(_prev: TrackState, form: FormData): Promise<TrackState> {
  const jarvis = await getJarvis();
  if (!jarvis) return { error: 'The dashboard is not connected to the JARVIS API.' };
  const file = form.get('csv');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file.' };
  if (file.size > 1_000_000) return { error: 'The file is larger than 1 MB.' };

  const { data, error } = await jarvis.POST('/businesses/import', {
    body: { csv: await file.text() },
  });
  if (!data) return { error: error?.error.message ?? 'Could not import the file.' };
  revalidatePath('/');
  return {
    message: `Imported ${data.created} new business${data.created === 1 ? '' : 'es'}.`,
    skipped: data.skipped,
  };
}
