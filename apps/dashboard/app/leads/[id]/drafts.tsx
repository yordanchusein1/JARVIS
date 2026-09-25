'use client';

import { useState } from 'react';
import { sendLinks, type components } from '@arclighthq/sdk';

type Draft = components['schemas']['Draft'];
type Contact = components['schemas']['Contact'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function DraftCard({ draft, contacts }: { draft: Draft; contacts: Contact[] }) {
  const full = draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body;
  return (
    <section className="card">
      <h2>{draft.channel === 'whatsapp' ? 'WhatsApp message' : 'Email'}</h2>
      {draft.subject && (
        <p>
          <span className="muted small">Subject: </span>
          <strong>{draft.subject}</strong>
        </p>
      )}
      <p className="draft-body">{draft.body}</p>
      {draft.warnings.map((w) => (
        <p key={w} className="warning small">
          ⚠ {w}
        </p>
      ))}
      <div className="actions">
        <CopyButton text={full} />
        {sendLinks(draft, contacts).map((link) => (
          <a
            key={link.href}
            className="button"
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
