// `helm lint` and `helm template` for the shared chart with every fixture and for every application
// under deploy/apps, and `helm template` for every third-party chart an Application in deploy/argocd installs,
// at its pinned version and with its inline values (ADR-019, ADR-045). Helm is a local requirement (AGENTS.md).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ChartFetchError,
  readChartApplications,
  renderApplication,
} from './lib/argocd-application.ts';

const deploy = resolve(import.meta.dirname, '../deploy');
const chart = `${deploy}/charts/app`;

const cases: { name: string; values: string[] }[] = [];

for (const file of readdirSync(`${chart}/ci`).filter((name) => name.endsWith('.yaml'))) {
  cases.push({ name: `ci/${file}`, values: [`${chart}/ci/${file}`] });
}

const appsDir = `${deploy}/apps`;
if (existsSync(appsDir)) {
  for (const app of readdirSync(appsDir)) {
    const values = ['values.yaml', 'secrets.yaml', 'image.yaml']
      .map((file) => `${appsDir}/${app}/${file}`)
      .filter((file) => existsSync(file));
    if (values.length > 0) cases.push({ name: `apps/${app}`, values });
  }
}

let failed = 0;
for (const { name, values } of cases) {
  const valueArgs = values.flatMap((file) => ['-f', file]);
  const commands = [
    ['lint', chart, ...valueArgs],
    ['template', 'check', chart, '--namespace', 'apps', ...valueArgs],
  ];
  for (const args of commands) {
    try {
      execFileSync('helm', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) {
      failed += 1;
      console.error(
        `FAIL helm ${args[0]} ${name}\n${String((error as { stderr?: Buffer }).stderr)}`,
      );
    }
  }
}

// A third-party chart is fetched from its repository. Offline, that says nothing about the Application, so a
// local run skips it with a warning; CI (`CI` is set) has the network and fails, so drift cannot hide there.
const applications = readChartApplications(`${deploy}/argocd`);
let rendered = 0;
for (const app of applications) {
  const label = `${app.chart} ${app.version} (${app.file.slice(deploy.length + 1)})`;
  try {
    renderApplication(app);
    rendered += 1;
  } catch (error) {
    if (error instanceof ChartFetchError && !process.env.CI) {
      console.warn(`SKIP helm template ${label}: chart repository not reachable\n${error.message}`);
      continue;
    }
    failed += 1;
    console.error(`FAIL helm template ${label}\n${(error as Error).message}`);
  }
}

if (failed > 0) process.exit(1);
console.log(
  `charts-check: OK (${cases.length} value sets, lint and template; ${rendered} of ${applications.length} third-party charts rendered)`,
);
