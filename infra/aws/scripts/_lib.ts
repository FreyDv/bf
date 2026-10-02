// Shared helpers for the operational scripts. Every script runs the same way on a laptop and in GitHub Actions:
//   node infra/aws/scripts/<name>.ts [args]      (Node ≥ 26 runs TypeScript directly; AWS credentials from the environment)
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DescribeInstancesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { GetCommandInvocationCommand, SendCommandCommand, SSMClient } from '@aws-sdk/client-ssm';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

import { discoverApps } from '../../../scripts/apps.mjs';
import { config, names } from '../lib/config.ts';

export const awsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(awsDir, '../..');

/** Options for every SDK client: the region always comes from lib/config.ts, never from the shell. */
export const sdk = { region: config.region };

export async function accountId(): Promise<string> {
  const { Account } = await new STSClient(sdk).send(new GetCallerIdentityCommand({}));
  if (!Account) throw new Error('could not resolve the AWS account — are credentials configured?');
  return Account;
}

/** One entry of scripts/apps.mjs (plain JS, so its shape is declared here). */
export interface App {
  name: string;
  path: string;
  kind: 'nest' | 'next' | 'other';
  dockerfile: string | null;
  migrations: boolean;
}

/** Apps from scripts/apps.mjs (the single source of truth), optionally narrowed to the given names. v1*/
export function apps(only: string[] = []): App[] {
  const cwd = process.cwd();
  process.chdir(repoRoot); // apps.mjs scans ./apps
  try {
    const all = discoverApps() as App[];
    const unknown = only.filter((name) => !all.some((a) => a.name === name));
    if (unknown.length) throw new Error(`unknown app(s): ${unknown.join(', ')}`);
    return only.length ? all.filter((a) => only.includes(a.name)) : all;
  } finally {
    process.chdir(cwd);
  }
}

/** Runs a program with inherited stdio; throws if it exits non-zero. */
export function run(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string } = {},
) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    input: options.input,
    stdio: [options.input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

export const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const TIMEOUT_SECONDS = 1800;

/** The running instance tagged bf:env=<env>. */
export async function findHost(): Promise<string> {
  const { Reservations = [] } = await new EC2Client(sdk).send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: `tag:${names.hostTag.key}`, Values: [names.hostTag.value] },
        { Name: 'instance-state-name', Values: ['running'] },
      ],
    }),
  );
  const ids = Reservations.flatMap((r) => r.Instances ?? []).map((i) => i.InstanceId!);
  if (ids.length !== 1) {
    throw new Error(
      `expected exactly one running host, found ${ids.length} — is ${names.stack} deployed?`,
    );
  }
  return ids[0]!;
}

/** Sends the script and polls until it finishes; returns the invocation (status + output). */
export async function runOnHost(
  instanceId: string,
  commands: string[],
  comment = 'bf host deploy',
) {
  const ssm = new SSMClient(sdk);
  const { Command } = await ssm.send(
    new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: 'AWS-RunShellScript',
      Comment: comment,
      TimeoutSeconds: 60,
      Parameters: { commands, executionTimeout: [String(TIMEOUT_SECONDS)] },
    }),
  );
  const commandId = Command!.CommandId!;
  console.log(`ssm command ${commandId} on ${instanceId} — waiting…`);

  const deadline = Date.now() + (TIMEOUT_SECONDS + 120) * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const invocation = await ssm
      .send(new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId }))
      .catch((error: Error) => {
        if (error.name === 'InvocationDoesNotExist') return undefined; // not registered yet
        throw error;
      });
    if (invocation && !['Pending', 'InProgress', 'Delayed'].includes(invocation.Status ?? '')) {
      return invocation;
    }
  }
  throw new Error(`ssm command ${commandId} did not finish in time`);
}

/** `--name value` from argv, or undefined. */
export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Positional arguments (everything that is not a `--flag value` pair). */
export function positionals(): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]!.startsWith('--')) i++;
    else out.push(argv[i]!);
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
