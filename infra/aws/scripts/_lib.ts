// Shared helpers for the operational scripts. Every script runs the same way on a laptop and in GitHub Actions:
//   node infra/aws/scripts/<name>.ts [args]      (Node ≥ 26 runs TypeScript directly; AWS credentials from the environment)
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

import { discover } from '../lib/apps.ts';
import { config, names } from '../lib/config.ts';

import type { PlatformParameter } from '../lib/config.ts';

export type { App } from '../lib/apps.ts';
export { repoRoot } from '../lib/apps.ts';

export const awsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Options for every SDK client: the region always comes from lib/config.ts, never from the shell. */
export const sdk = { region: config.region };

export async function accountId(): Promise<string> {
  const { Account } = await new STSClient(sdk).send(new GetCallerIdentityCommand({}));
  if (!Account) throw new Error('could not resolve the AWS account — are credentials configured?');
  return Account;
}

/** Apps from scripts/apps.mjs (the single source of truth), optionally narrowed to the given names. */
export const apps = discover;

/** Ids the platform stack publishes for the scripts (subnets, security group, distribution, …). */
export async function platformParams<K extends PlatformParameter>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const { Parameters = [], InvalidParameters = [] } = await new SSMClient(sdk).send(
    new GetParametersCommand({ Names: keys.map((key) => names.platformParameter(key)) }),
  );
  if (InvalidParameters.length)
    throw new Error(
      `missing SSM parameter(s) ${InvalidParameters.join(', ')} — is the stack ${names.stack} deployed?`,
    );
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = Parameters.find((p) => p.Name === names.platformParameter(key))?.Value;
    if (!value) throw new Error(`empty SSM parameter ${names.platformParameter(key)}`);
    out[key] = value;
  }
  return out;
}

/** Runs a program with inherited stdio; throws if it exits non-zero. */
export function run(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; env?: Record<string, string> } = {},
) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? resolve(awsDir, '../..'),
    input: options.input,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: [options.input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

export const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** `--name value` from argv, or undefined. */
export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** `--name` present in argv (no value). */
export const has = (name: string) => process.argv.includes(`--${name}`);

/** Positional arguments (everything that is not a `--flag value` pair; bare `--switch`es listed in `switches` take no value). */
export function positionals(switches: string[] = []): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      if (!switches.includes(arg.slice(2))) i++;
    } else out.push(arg);
  }
  return out;
}

/** Appends Markdown to the GitHub job summary; a no-op on a laptop. */
export function summary(markdown: string) {
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

/** Wraps a script's main(): prints a short error instead of a stack trace and sets the exit code. */
export function main(fn: () => Promise<void>) {
  fn().catch((error: unknown) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

/** True when this module is the entry point (`node x.ts`), false when imported by another script. */
export const isEntry = (moduleUrl: string) =>
  process.argv[1] !== undefined && moduleUrl === new URL(`file://${process.argv[1]}`).href;
