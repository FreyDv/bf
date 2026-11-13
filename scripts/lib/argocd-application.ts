// Reads the ArgoCD Applications in deploy/argocd/ that install a third-party Helm chart, and renders that chart
// with the Application's own pinned version and inline values (ADR-019, ADR-045). There is no YAML parser in the
// repository and a new dependency needs an ADR, so the Application is read by its fixed layout and a file that
// departs from it fails loudly instead of being half understood.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ChartApplication {
  file: string;
  name: string;
  repoURL: string;
  chart: string;
  version: string;
  namespace: string;
  values: string;
}

// Helm could not reach the chart repository: the one failure that says nothing about the Application itself.
export class ChartFetchError extends Error {}

const NETWORK_FAILURE =
  /dial tcp|no such host|i\/o timeout|connection refused|network is unreachable|TLS handshake|context deadline/i;

function scalar(source: string, key: string, file: string): string {
  const match = new RegExp(`^\\s*${key}: *"?([^"\\s#]+)"?\\s*$`, 'm').exec(source);
  if (!match) throw new Error(`${file}: no \`${key}:\` found`);
  return match[1];
}

// The lines nested under `key:`, with their common indent removed; null when the key is absent.
function blockUnder(source: string, key: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*$`).test(line));
  if (start === -1) return null;
  const indentOf = (line: string) => /^\s*/.exec(line)![0].length;
  const parentIndent = indentOf(lines[start]);
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && indentOf(line) <= parentIndent) break;
    block.push(line);
  }
  const indents = block.filter((line) => line.trim() !== '').map(indentOf);
  if (indents.length === 0) return null;
  const strip = Math.min(...indents);
  return block.map((line) => line.slice(strip)).join('\n') + '\n';
}

export function readChartApplications(dir: string): ChartApplication[] {
  const apps: ChartApplication[] = [];
  for (const entry of readdirSync(dir).filter((name) => name.endsWith('.yaml'))) {
    const file = `${dir}/${entry}`;
    const source = readFileSync(file, 'utf8');
    if (!/^kind: Application$/m.test(source) || !/^\s*chart: /m.test(source)) continue;
    const version = scalar(source, 'targetRevision', file);
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`${file}: targetRevision \`${version}\` is not an exact version (ADR-005)`);
    }
    const destination = blockUnder(source, 'destination');
    const values = blockUnder(source, 'valuesObject');
    if (!destination) throw new Error(`${file}: no \`destination:\` block found`);
    if (!values)
      throw new Error(`${file}: no \`valuesObject:\` block found (values go inline, ADR-045)`);
    apps.push({
      file,
      name: scalar(source.slice(source.indexOf('metadata:')), 'name', file),
      repoURL: scalar(source, 'repoURL', file),
      chart: scalar(source, 'chart', file),
      version,
      namespace: scalar(destination, 'namespace', file),
      values,
    });
  }
  return apps;
}

export function renderApplication(app: ChartApplication): string {
  const scratch = mkdtempSync(join(tmpdir(), 'argocd-app-'));
  try {
    const valuesFile = join(scratch, 'values.yaml');
    writeFileSync(valuesFile, app.values);
    return execFileSync(
      'helm',
      [
        'template',
        app.name,
        app.chart,
        '--repo',
        app.repoURL,
        '--version',
        app.version,
        '--namespace',
        app.namespace,
        '--include-crds',
        '-f',
        valuesFile,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer | string }).stderr ?? error);
    if (NETWORK_FAILURE.test(stderr)) throw new ChartFetchError(stderr);
    throw new Error(stderr);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
