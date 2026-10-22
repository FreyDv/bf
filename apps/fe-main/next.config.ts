import type { NextConfig } from 'next';

/**
 * Static export: `next build` writes `out/`, served by S3 + CloudFront in production and by nginx in
 * docker compose (docker/next.Dockerfile). Consequences: no middleware, no route handlers, no server
 * components with request data, `next/image` unoptimized, every route ends with a slash (`/x/` → `/x/index.html`).
 * Security headers live in the CloudFront response-headers policy / nginx, not here (`headers()` is ignored in export mode).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@bf/ui', '@bf/contracts'],
};

export default nextConfig;
