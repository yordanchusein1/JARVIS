'use server';

import { revalidatePath } from 'next/cache';
import { getArclight } from '@/lib/arclight';

export interface HuntFormState {
  message?: string;
  error?: string;
}

const NOT_CONNECTED = 'The dashboard is not connected to the Arclight API.';

function settingsFrom(form: FormData) {
  const number = (name: string, fallback: number) => {
    const value = Number(form.get(name));
    return Number.isInteger(value) ? value : fallback;
  };
  return {
    query: String(form.get('query') ?? '').trim(),
    runHour: number('runHour', 7),
    maxNewPerRun: number('maxNewPerRun', 10),
    minReviews: number('minReviews', 0),
    includeNoWebsite: form.get('includeNoWebsite') === 'on',
    autoDraft: form.get('autoDraft') === 'on',
    autoDraftMinPriority: number('autoDraftMinPriority', 50),
  };
}

function refresh() {
  revalidatePath('/hunts');
  revalidatePath('/');
}

export async function saveHuntAction(_prev: HuntFormState, form: FormData): Promise<HuntFormState> {
  const arclight = await getArclight();
  if (!arclight) return { error: NOT_CONNECTED };
  const id = String(form.get('id') ?? '');
  const body = settingsFrom(form);
  const { error } = id
    ? await arclight.PATCH('/hunts/{id}', { params: { path: { id } }, body })
    : await arclight.POST('/hunts', { body });
  if (error) {
    return {
      error:
        error.error.code === 'invalid_request'
          ? 'Check the fields: the search needs at least 2 characters and numbers must be in range.'
          : error.error.message,
    };
  }
  refresh();
  return { message: id ? 'Saved.' : 'Hunt created.' };
}

export async function runHuntAction(id: string): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error(NOT_CONNECTED);
  await arclight.POST('/hunts/{id}/runs', { params: { path: { id } } });
  refresh();
}

export async function setHuntActiveAction(id: string, active: boolean): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error(NOT_CONNECTED);
  await arclight.PATCH('/hunts/{id}', { params: { path: { id } }, body: { active } });
  refresh();
}

export async function setAutomationPausedAction(paused: boolean): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error(NOT_CONNECTED);
  await arclight.PATCH('/agency-profile', { body: { automationPaused: paused } });
  refresh();
}

export async function deleteHuntAction(id: string): Promise<void> {
  const arclight = await getArclight();
  if (!arclight) throw new Error(NOT_CONNECTED);
  await arclight.DELETE('/hunts/{id}', { params: { path: { id } } });
  refresh();
}
