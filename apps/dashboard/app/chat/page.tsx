import '@arclighthq/react/styles.css';
import { ArclightProvider, Chat } from '@arclighthq/react';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  await requireSession();
  return (
    <>
      <h1>Chat</h1>
      <p className="muted">
        Ask Arclight about your leads, find new ones, or have it write a message. It never sends
        anything itself.
      </p>
      <ArclightProvider leadUrl="/leads/:id">
        <Chat />
      </ArclightProvider>
    </>
  );
}
