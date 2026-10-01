import { config } from './config.ts';

/**
 * `docker build --build-arg` values for one app — the same for the deploy workflow and scripts/push-images.ts.
 * NEXT_PUBLIC_* are inlined into the Next.js bundle at build time, so the public URLs must be known here.
 */
export function imageBuildArgs(app: { name: string; kind: string }): Record<string, string> {
  if (app.kind !== 'next') return { APP: app.name };
  const admin = app.name === 'fe-admin';
  return {
    APP: app.name,
    NEXT_PUBLIC_APP_NAME: admin ? 'bf admin' : 'bf',
    NEXT_PUBLIC_APP_URL: `https://${admin ? config.domains.admin : config.domains.main}`,
    NEXT_PUBLIC_API_URL: `https://${config.domains.api}`,
  };
}
