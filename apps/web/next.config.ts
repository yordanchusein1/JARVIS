import type { NextConfig } from 'next';

// A static site: `next build` writes plain HTML to out/, which any host (including Vercel) can serve.
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default config;
