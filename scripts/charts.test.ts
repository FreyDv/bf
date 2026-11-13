// Behaviour of the shared chart deploy/charts/app (ADR-019): what it renders, and what it refuses.
// Runs `helm template`, so Helm is a local requirement (AGENTS.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { readChartApplications, renderApplication } from './lib/argocd-application.ts';

const deploy = resolve(import.meta.dirname, '../deploy');
const chart = `${deploy}/charts/app`;
const minimal = `${chart}/ci/minimal.yaml`;
const full = `${chart}/ci/full.yaml`;

function render(values: string[], set: string[] = []): string {
  const args = ['template', 'web', chart, '--namespace', 'apps'];
  for (const file of values) args.push('-f', file);
  for (const item of set) args.push('--set', item);
  return execFileSync('helm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function renderFails(values: string[], set: string[] = []): string {
  try {
    render(values, set);
  } catch (error) {
    return String((error as { stderr?: Buffer | string }).stderr ?? error);
  }
  assert.fail('helm template was expected to fail');
}

const docs = (output: string) => output.split(/^---$/m).filter((doc) => /^kind:/m.test(doc));
const kindOf = (doc: string) => /^kind: (\w+)/m.exec(doc)?.[1];
const kinds = (output: string) => docs(output).map(kindOf).sort();
const find = (output: string, kind: string) =>
  docs(output).find((doc) => kindOf(doc) === kind) ?? '';
const checksum = (output: string) =>
  /checksum\/secret: (\w+)/.exec(find(output, 'Deployment'))?.[1];

describe('app chart: what it renders', () => {
  it('renders a Deployment, a Service and a ServiceAccount from an image alone', () => {
    assert.deepEqual(kinds(render([minimal])), ['Deployment', 'Service', 'ServiceAccount']);
  });

  it('renders every optional object when its feature is on', () => {
    assert.deepEqual(kinds(render([full])), [
      'CronJob',
      'Deployment',
      'Ingress',
      'Job',
      'SealedSecret',
      'Service',
      'ServiceAccount',
    ]);
  });

  it('runs the migration Job before the sync and seals the secret before the Job', () => {
    const output = render([full]);
    const job = find(output, 'Job');
    assert.match(job, /argocd\.argoproj\.io\/hook: PreSync/);
    assert.match(job, /argocd\.argoproj\.io\/hook-delete-policy: BeforeHookCreation/);
    assert.match(find(output, 'SealedSecret'), /argocd\.argoproj\.io\/sync-wave: "-1"/);
  });

  it('mounts the built secret and the named ones into the Deployment, the CronJob and the Job', () => {
    const output = render([full]);
    for (const kind of ['Deployment', 'CronJob', 'Job']) {
      const doc = find(output, kind);
      assert.match(doc, /name: web-secrets/, `${kind} reads the built secret`);
      assert.match(doc, /name: shared-config/, `${kind} reads the named secret`);
    }
  });

  it('runs as non-root with no extra privileges and a read-only root filesystem', () => {
    const output = render([minimal]);
    const deployment = find(output, 'Deployment');
    assert.match(deployment, /runAsNonRoot: true/);
    assert.match(deployment, /allowPrivilegeEscalation: false/);
    assert.match(deployment, /readOnlyRootFilesystem: true/);
    assert.match(deployment, /drop: \[ALL\]/);
    assert.match(deployment, /automountServiceAccountToken: false/);
  });
});

describe('app chart: secret hash in the Deployment', () => {
  it('has no hash when the application has no secret', () => {
    assert.equal(checksum(render([minimal])), undefined);
  });

  it('keeps the hash for the same secret', () => {
    assert.equal(checksum(render([full])), checksum(render([full])));
  });

  it('changes the hash when a sealed value changes, so the pods restart', () => {
    const before = checksum(render([full]));
    const after = checksum(render([full], ['secret.encryptedData.DATABASE_URL=AgBchanged']));
    assert.ok(before && after);
    assert.notEqual(before, after);
  });

  it('keeps the hash when something other than the secret changes', () => {
    const before = checksum(render([full]));
    const after = checksum(render([full], ['replicas=3', 'env.LOG_LEVEL=debug']));
    assert.equal(before, after);
  });
});

describe('app chart: what it refuses', () => {
  it('refuses a missing image tag', () => {
    assert.match(renderFails([minimal], ['image.tag=']), /image\.tag is required/);
  });

  it('refuses the latest tag', () => {
    assert.match(renderFails([minimal], ['image.tag=latest']), /not latest/);
  });

  it('refuses an enabled ingress without a host', () => {
    assert.match(renderFails([minimal], ['ingress.enabled=true']), /ingress\.host is required/);
  });

  it('refuses a cron job name that would not fit the CronJob limit', () => {
    const name = 'x'.repeat(50);
    const failure = renderFails(
      [minimal],
      [`cronJobs[0].name=${name}`, 'cronJobs[0].schedule=* * * * *'],
    );
    assert.match(failure, /longer than 52 characters/);
  });
});

describe('sealed-secrets Application (ADR-020, ADR-045)', () => {
  const [app] = readChartApplications(`${deploy}/argocd`).filter(
    (item) => item.chart === 'sealed-secrets',
  );

  it('pins an exact chart version', () => {
    assert.ok(app, 'deploy/argocd has a sealed-secrets Application');
    assert.match(app.version, /^\d+\.\d+\.\d+$/);
  });

  it('installs the controller where kubeseal looks for it, under the name it expects', () => {
    const output = renderApplication(app);
    assert.equal(app.namespace, 'kube-system');
    assert.match(
      find(output, 'Deployment'),
      /name: sealed-secrets-controller\n\s+namespace: kube-system/,
    );
    assert.match(find(output, 'Service'), /name: sealed-secrets-controller\n/);
  });

  it('turns automatic key renewal off, so the one-copy key backup cannot go stale (ADR-045)', () => {
    assert.match(find(renderApplication(app), 'Deployment'), /--key-renew-period\n\s+- "0"/);
  });

  it('ships the SealedSecret CRD that the app chart renders', () => {
    const crd = find(renderApplication(app), 'CustomResourceDefinition');
    assert.match(crd, /name: sealedsecrets\.bitnami\.com/);
    assert.match(crd, /v1alpha1/);
  });
});
