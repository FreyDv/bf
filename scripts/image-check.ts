// Image checks of CI (ADR-029) and the choice of what to build (ADR-028), as one runnable file so that the
// pinned tool images have one home (R4). hadolint and Trivy run as Docker images pinned by digest, not as
// downloaded binaries (ADR-036); Docker is the only local requirement.
//
//   node scripts/image-check.ts lint [Dockerfile...]   hadolint; an error blocks (default: apps/*/Dockerfile)
//   node scripts/image-check.ts secrets <image>        Trivy secret scan of the layers; a finding blocks
//   node scripts/image-check.ts vulns <image>          Trivy HIGH and CRITICAL with a fix; never blocks
//   node scripts/image-check.ts affected               which apps need an image build; writes $GITHUB_OUTPUT
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Bump deliberately: a version older than the 7-day cooldown (ADR-005) and its digest from the registry.
const HADOLINT =
  'hadolint/hadolint:v2.15.1@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d';
const TRIVY =
  'aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c';

// A change to any of these can break every image, so it rebuilds all of them on a pull request.
const SHARED_INPUTS = /^(\.dockerignore|scripts\/image-check\.ts|\.github\/workflows\/ci\.yml)$/;

// The frontend image type-checks the backend files that packages/contracts reaches by relative path (ADR-035),
// but backend is not a dependency of frontend in the Turborepo graph, so `turbo ls --affected` does not see
// them (CONTRACT-2). A change to one of them selects the frontend image too.
const BACKEND_CONTRACT_FILES = /^apps\/backend\/src\/.*\.(request\.dto|response\.dto|enum)\.ts$/;

const root = resolve(import.meta.dirname, '..');

const apps = () =>
  readdirSync(`${root}/apps`).filter((app) => existsSync(`${root}/apps/${app}/Dockerfile`));

const docker = (args: string[], options: { capture?: boolean } = {}) =>
  spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

const trivy = (args: string[], capture = false) =>
  docker(['run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', TRIVY, ...args], {
    capture,
  });

function lint(files: string[]): number {
  const targets = files.length > 0 ? files : apps().map((app) => `apps/${app}/Dockerfile`);
  if (targets.length === 0) {
    console.error('image-check lint: no Dockerfile found');
    return 1;
  }
  // The source is mounted read-only; the path inside the report is the repo-relative one.
  const result = docker([
    'run',
    '--rm',
    '-v',
    `${root}:/work:ro`,
    '-w',
    '/work',
    HADOLINT,
    'hadolint',
    '--failure-threshold',
    'error',
    ...targets,
  ]);
  return result.status ?? 1;
}

type SecretFinding = { RuleID: string; Severity: string; Title: string; StartLine: number };

function secrets(image: string): number {
  // The report is parsed, not printed whole: the table lists every scanned file, a finding would drown in it.
  const result = trivy(
    [
      'image',
      '--scanners',
      'secret',
      '--no-progress',
      '--skip-version-check',
      '--quiet',
      '--format',
      'json',
      image,
    ],
    true,
  );
  let report: { Results?: { Target: string; Secrets?: SecretFinding[] }[] };
  try {
    report = JSON.parse(result.stdout);
  } catch {
    // A scanner that did not run proves nothing, so it blocks as well (ADR-029 item 2).
    console.error(`image-check secrets: Trivy gave no report for ${image}\n${result.stderr}`);
    return 1;
  }
  const findings = (report.Results ?? []).flatMap((entry) =>
    (entry.Secrets ?? []).map(
      (secret) =>
        `${entry.Target}:${secret.StartLine} ${secret.Severity} ${secret.RuleID} (${secret.Title})`,
    ),
  );
  if (findings.length > 0) {
    console.error(
      `image-check secrets: ${findings.length} secret(s) in the layers of ${image}\n${findings.join('\n')}`,
    );
    return 1;
  }
  console.log(`image-check secrets: no secrets in the layers of ${image}`);
  return 0;
}

type Vulnerability = {
  VulnerabilityID: string;
  Severity: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
};

function vulns(image: string): number {
  const result = trivy(
    [
      'image',
      '--scanners',
      'vuln',
      '--severity',
      'HIGH,CRITICAL',
      '--ignore-unfixed',
      '--no-progress',
      '--skip-version-check',
      '--quiet',
      '--format',
      'json',
      image,
    ],
    true,
  );
  let rows: string[] = [];
  try {
    const report = JSON.parse(result.stdout) as {
      Results?: { Target: string; Vulnerabilities?: Vulnerability[] }[];
    };
    rows = (report.Results ?? []).flatMap((entry) =>
      (entry.Vulnerabilities ?? []).map(
        (v) =>
          `| ${v.Severity} | ${v.VulnerabilityID} | ${v.PkgName} | ${v.InstalledVersion} | ${v.FixedVersion ?? ''} | ${entry.Target} |`,
      ),
    );
  } catch {
    // ADR-029 item 3: vulnerabilities never block, so a scanner that could not run is a warning, not a failure.
    console.log(
      `::warning::Trivy vulnerability scan gave no report for ${image}\n${result.stderr}`,
    );
    return 0;
  }
  const body = [
    `### Trivy: HIGH and CRITICAL with a fix, ${image}`,
    '',
    rows.length === 0
      ? 'None.'
      : [
          '| Severity | Id | Package | Installed | Fixed | Target |',
          '|---|---|---|---|---|---|',
          ...rows,
        ].join('\n'),
    '',
  ].join('\n');
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) appendFileSync(summary, body);
  else process.stdout.write(body);
  return 0;
}

function affected(): number {
  const all = apps();
  const base = process.env['GITHUB_BASE_REF'];
  let selected = all;
  if (process.env['GITHUB_EVENT_NAME'] === 'pull_request' && base) {
    const changed = execFileSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    if (!changed.some((file) => SHARED_INPUTS.test(file))) {
      const printed = execFileSync(
        'pnpm',
        ['exec', 'turbo', 'ls', '--affected', '--output', 'json'],
        // Without this Turborepo looks for a local `main`, which a CI checkout does not have, and falls back to everything.
        { cwd: root, encoding: 'utf8', env: { ...process.env, TURBO_SCM_BASE: `origin/${base}` } },
      );
      // Turborepo may print a line such as "Scope: all 5 workspace projects" before the JSON.
      const listing = JSON.parse(printed.slice(printed.indexOf('{'))) as {
        packages: { items: { path: string }[] };
      };
      const paths = new Set(listing.packages.items.map((item) => item.path));
      selected = all.filter((app) => paths.has(`apps/${app}`));
      if (changed.some((file) => BACKEND_CONTRACT_FILES.test(file)) && all.includes('frontend')) {
        selected = [...new Set([...selected, 'frontend'])];
      }
    }
  }
  const output = process.env['GITHUB_OUTPUT'];
  for (const app of all) {
    const line = `${app}=${selected.includes(app)}`;
    console.log(line);
    if (output) appendFileSync(output, `${line}\n`);
  }
  return 0;
}

const [command, ...rest] = process.argv.slice(2);
const needImage = () => {
  if (!rest[0]) {
    console.error(`image-check ${command}: pass the image name`);
    process.exit(2);
  }
  return rest[0];
};

switch (command) {
  case 'lint':
    process.exit(lint(rest));
  case 'secrets':
    process.exit(secrets(needImage()));
  case 'vulns':
    process.exit(vulns(needImage()));
  case 'affected':
    process.exit(affected());
  default:
    console.error('usage: node scripts/image-check.ts lint|secrets|vulns|affected [args]');
    process.exit(2);
}
