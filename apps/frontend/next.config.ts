import type { NextConfig } from 'next';

// Content-Security-Policy is built per request in proxy.ts (nonce, ADR-066), not here. Nothing else is sent
// from this file: HSTS, nosniff, Referrer-Policy and X-Frame-Options come from the ingress (ADR-038 item 5).
const config: NextConfig = {
  output: 'standalone',
};

export default config;
