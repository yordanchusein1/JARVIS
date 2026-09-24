import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'JARVIS',
  description: 'AI Chief of Staff for agencies',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="brand">JARVIS</span>
          <span className="muted">Lead Hunter</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
