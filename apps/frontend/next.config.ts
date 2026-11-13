import type { NextConfig } from 'next';

// The Content-Security-Policy is not here: it needs a per-request nonce, so proxy.ts sets it (ADR-059).
const config: NextConfig = {
  output: 'standalone',
};

export default config;
