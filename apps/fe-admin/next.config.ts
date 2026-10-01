import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained build for the ECS Docker image (see Dockerfile).
  output: 'standalone',
  // Trace files from the monorepo root so workspace packages end up in .next/standalone.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@bf/ui', '@bf/contracts'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
