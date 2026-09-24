import type { NextConfig } from 'next';

const config: NextConfig = {
  // The Docker image runs the standalone server; `next start` needs the regular output.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  transpilePackages: ['@arclight/sdk'],
};

export default config;
