// Which image each service runs, and how the static frontends are built. Shared by the stacks and the scripts.
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

import { config, names } from './config.ts';

import type { App } from './apps.ts';

/** `docker build --build-arg` values for one Nest app (frontends are not images in production). */
export function imageBuildArgs(app: { name: string }): Record<string, string> {
  return { APP: app.name };
}

/** Build-time environment of a static frontend: NEXT_PUBLIC_* are inlined into the bundle. */
export function staticBuildEnv(app: Pick<App, 'name' | 'basePath'>): Record<string, string> {
  const admin = app.name === 'fe-admin';
  return {
    NEXT_PUBLIC_APP_NAME: admin ? 'bf admin' : 'bf',
    NEXT_PUBLIC_APP_URL: `${config.publicUrls.main}${app.basePath}`,
    NEXT_PUBLIC_API_URL: config.publicUrls.api,
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

/** Floating tag every image also carries (`:prod`): what a service runs until a release pins a sha. */
export const DEFAULT_IMAGE_TAG = config.env;

/**
 * Image tag per app for `cdk synth`: SSM /bf/<env>/images/<app> (written by scripts/ecs-deploy.ts after every
 * release), so an infra deploy never reverts a service to an older image. Without credentials (PR checks) or
 * without the parameter (first deploy) → the floating tag. BF_IMAGE_TAG=<tag> overrides everything.
 */
export async function imageTags(apps: string[]): Promise<Record<string, string>> {
  const fallback = Object.fromEntries(
    apps.map((app) => [app, process.env.BF_IMAGE_TAG || DEFAULT_IMAGE_TAG]),
  );
  if (process.env.BF_IMAGE_TAG || !apps.length) return fallback;
  const ssm = new SSMClient({ region: config.region });
  const tags = { ...fallback };
  try {
    for (let i = 0; i < apps.length; i += 10) {
      const chunk = apps.slice(i, i + 10);
      const { Parameters = [] } = await ssm.send(
        new GetParametersCommand({ Names: chunk.map((app) => names.imageParameter(app)) }),
      );
      for (const p of Parameters) {
        const app = p.Name?.split('/').pop();
        if (app && p.Value) tags[app] = p.Value;
      }
    }
  } catch (error) {
    console.error(
      `[images] could not read ${names.imageParameter('*')} (${error instanceof Error ? error.name : String(error)}) → using :${DEFAULT_IMAGE_TAG}`,
    );
    return fallback;
  }
  return tags;
}
