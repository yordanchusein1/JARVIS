'use client';

import { startTransition, type FormEvent } from 'react';

/**
 * Submits a form to an action without React's automatic form reset, so what the person typed
 * survives a validation error. Use it as the form's onSubmit.
 */
export function submitKeepingInput(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}
