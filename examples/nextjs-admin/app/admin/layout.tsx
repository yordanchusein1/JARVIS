import '@arclighthq/react/styles.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArclightProvider } from '@arclighthq/react';

// Every admin page can use Arclight's components; lead names link to the admin's lead page.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <nav className="sidebar">
        <strong>Agency admin</strong>
        <Link href="/admin">Today</Link>
        <Link href="/admin/pipeline">Pipeline</Link>
        <Link href="/admin/chat">Ask Arclight</Link>
      </nav>
      <main className="content">
        <ArclightProvider leadUrl="/admin/leads/:id">{children}</ArclightProvider>
      </main>
    </div>
  );
}
