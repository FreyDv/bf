// Reads the ArgoCD Applications in deploy/argocd/ that install a third-party Helm chart, and renders that chart
// with the Application's own pinned version and values: inline `valuesObject` (ADR-045) or, for a multi-source
// Application, `helm.valueFiles` of the form `$ref/<path>` that point into this repository (ADR-046). There is no
// YAML parser in the repository and a new dependency needs an ADR, so the Application is read by its fixed layout
// (the chart source first, the `ref` source after it) and a file that departs from it fails loudly instead of being
// half understood.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface ChartApplication {
  file: string;
  name: string;
  repoURL: string;
  chart: string;
  version: string;
  namespace: string;
  // Helm release name: `helm.releaseName` when the Application sets it, else the Application name (ArgoCD's default).
  releaseName: string;
  // Absolute paths of the value files the Application lists, in order; they go below the inline values.
  valueFiles: string[];
  // The inline `valuesObject`; empty when the Application takes all its values from files.
  values: string;
}

// Helm could not reach the chart repository: the one failure that says nothing about the Application itself.
export class ChartFetchError extends Error {}

const NETWORK_FAILURE =
  /dial tcp|no such host|i\/o timeout|connection refused|network is unreachable|TLS handshake|context deadline/i;

function scalar(source: string, key: string, file: string): string {
  const match = new RegExp(`^\\s*(?:- )?${key}: *"?([^"\\s#]+)"?\\s*$`, 'm').exec(source);
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

// The entries of the list under `key:` (`- item` lines), unquoted; empty when the key is absent.
function listUnder(source: string, key: string): string[] {
  const block = blockUnder(source, key);
  if (!block) return [];
  return block
    .split('\n')
    .map((line) => /^\s*- *"?([^"#]+?)"? *$/.exec(line)?.[1])
    .filter((item): item is string => item !== undefined);
}

// `$values/deploy/x.yaml` -> the file in this repository, after checking that a source declares `ref: values`.
function resolveValueFile(entry: string, source: string, dir: string, file: string): string {
  const match = /^\$([A-Za-z0-9_-]+)\/(.+)$/.exec(entry);
  if (!match) throw new Error(`${file}: valueFile \`${entry}\` must be \`$<ref>/<path>\``);
  if (!new RegExp(`^\\s*ref: *"?${match[1]}"?\\s*$`, 'm').test(source)) {
    throw new Error(`${file}: valueFile \`${entry}\` names a ref no source declares`);
  }
  // dir is <repo>/deploy/argocd; the ref source is this repository.
  return resolve(dir, '../..', match[2]);
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
    const values = blockUnder(source, 'valuesObject') ?? '';
    const valueFiles = listUnder(source, 'valueFiles').map((entry) =>
      resolveValueFile(entry, source, dir, file),
    );
    if (!destination) throw new Error(`${file}: no \`destination:\` block found`);
    if (!values && valueFiles.length === 0) {
      throw new Error(
        `${file}: neither \`valuesObject:\` nor \`valueFiles:\` found (ADR-045, ADR-046)`,
      );
    }
    const name = scalar(source.slice(source.indexOf('metadata:')), 'name', file);
    apps.push({
      file,
      name,
      repoURL: scalar(source, 'repoURL', file),
      chart: scalar(source, 'chart', file),
      version,
      namespace: scalar(destination, 'namespace', file),
      releaseName: /^\s*releaseName: /m.test(source) ? scalar(source, 'releaseName', file) : name,
      valueFiles,
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
    // ArgoCD merges the value files first and the inline values over them; Helm gives later -f files precedence.
    const valueArgs = [...app.valueFiles, ...(app.values ? [valuesFile] : [])].flatMap((file) => [
      '-f',
      file,
    ]);
    return execFileSync(
      'helm',
      [
        'template',
        app.releaseName,
        app.chart,
        '--repo',
        app.repoURL,
        '--version',
        app.version,
        '--namespace',
        app.namespace,
        '--include-crds',
        ...valueArgs,
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
