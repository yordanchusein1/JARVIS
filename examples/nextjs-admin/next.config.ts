import type { NextConfig } from 'next';

const config: NextConfig = {
  // Only needed inside the Arclight repository, where the packages are TypeScript sources.
  // With the packages installed from npm, remove this line.
  transpilePackages: ['@arclighthq/react', '@arclighthq/sdk'],
};

export default config;
