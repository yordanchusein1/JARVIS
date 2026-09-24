import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { isSignedIn } from '@/lib/auth';
import { logoutAction } from './login/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arclight',
  description: 'AI Chief of Staff for agencies',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const signedIn = await isSignedIn();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Arclight
          </Link>
          {signedIn && (
            <nav className="nav">
              <Link href="/">Leads</Link>
              <Link href="/find">Find</Link>
              <Link href="/settings">Settings</Link>
              <form action={logoutAction}>
                <button type="submit" className="link-button">
                  Sign out
                </button>
              </form>
            </nav>
          )}
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
