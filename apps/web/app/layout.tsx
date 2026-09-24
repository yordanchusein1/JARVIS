import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

const description =
  'Arclight finds businesses that need what your agency sells, proves it with evidence from their own website, and drafts the first message. Open source and self-hosted.';

// Absolute base for social images. SITE_URL wins; on Vercel the production URL is used.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3100');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Arclight: your agency's always-on lead hunter",
  description,
  openGraph: {
    title: "Arclight: your agency's always-on lead hunter",
    description,
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Arclight' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#04070C' },
    { media: '(prefers-color-scheme: light)', color: '#F5F8FC' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
