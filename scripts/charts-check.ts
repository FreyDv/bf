// `helm lint` and `helm template` for the shared chart with every fixture and for every application
// under deploy/apps (ADR-019). Helm is a local requirement (AGENTS.md).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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

if (failed > 0) process.exit(1);
console.log(`charts-check: OK (${cases.length} value sets, lint and template)`);
