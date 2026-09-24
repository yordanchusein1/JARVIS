'use client';

import { useState, useTransition } from 'react';
import { draftAction } from './actions';

export function DraftButton({ id, hasDrafts }: { id: string; hasDrafts: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        className="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError((await draftAction(id)).error);
          })
        }
      >
        {pending ? 'Writing…' : hasDrafts ? 'Write new drafts' : 'Write messages'}
      </button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
