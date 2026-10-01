// Tiny helpers shared by the CI scripts. They run with plain `node scripts/ci/<name>.ts` (Node ≥ 26 executes
// TypeScript directly), in GitHub Actions and on a laptop alike: outside Actions, outputs are printed instead.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { discoverApps } from '../apps.mjs';

/** One entry of scripts/apps.mjs (plain JS, so its shape is declared here). */
export interface App {
  name: string;
  path: string;
  kind: 'nest' | 'next' | 'other';
  dockerfile: string | null;
  migrations: boolean;
  e2e: boolean;
  unit: boolean;
  seed: boolean;
  envSchema: boolean;
}

export const allApps = (): App[] => discoverApps() as App[];

/** Sets a step output (`steps.<id>.outputs.<name>`); objects are written as compact JSON. */
export function setOutput(name: string, value: unknown) {
  const line = `${name}=${typeof value === 'string' ? value : JSON.stringify(value)}`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
  else console.log(line);
}

/** Appends Markdown to the job summary. */
export function summary(markdown: string) {
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  else console.log(markdown);
}

export function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** Files changed between `base` and HEAD under the given paths; `undefined` when the base is unknown. */
export function changedFiles(base: string | undefined, paths: string[]): string[] | undefined {
  if (!base || /^0+$/.test(base)) return undefined;
  try {
    return git('diff', '--name-only', base, 'HEAD', '--', ...paths)
      .split('\n')
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

/** Wraps a script's main(): a short error instead of a stack trace, non-zero exit code. */
export function main(fn: () => Promise<void> | void) {
  Promise.resolve()
    .then(fn)
    .catch((error: unknown) => {
      console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
