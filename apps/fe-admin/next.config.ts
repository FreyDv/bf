import type { NextConfig } from 'next';

/**
 * Static export under `/admin` (one public hostname: `/` fe-main, `/admin/*` fe-admin, `/api/*` the edge).
 * `next build` writes `out/`, served by S3 + CloudFront in production and by nginx in docker compose
 * (docker/next.Dockerfile). Consequences: no middleware, no route handlers, `next/image` unoptimized, every route ends
 * with a slash. Security headers live in the CloudFront response-headers policy / nginx (`headers()` is ignored in export mode).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/admin',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@bf/ui', '@bf/contracts'],
};

export default nextConfig;
