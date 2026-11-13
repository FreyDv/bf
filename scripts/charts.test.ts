// Behaviour of the shared chart deploy/charts/app (ADR-019): what it renders, and what it refuses.
// Runs `helm template`, so Helm is a local requirement (AGENTS.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

describe('app chart: ingress', () => {
  it('points an enabled ingress at the Traefik class unless told otherwise (ADR-038)', () => {
    assert.match(find(render([full]), 'Ingress'), /ingressClassName: traefik\n/);
    const other = find(render([full], ['ingress.className=other']), 'Ingress');
    assert.match(other, /ingressClassName: other\n/);
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

describe('nats Application (ADR-022, backlog NATS-1)', () => {
  const [app] = readChartApplications(`${deploy}/argocd`).filter((item) => item.chart === 'nats');

  it('pins an exact chart version and installs into the application namespace', () => {
    assert.ok(app, 'deploy/argocd has a nats Application');
    assert.match(app.version, /^\d+\.\d+\.\d+$/);
    assert.equal(app.namespace, 'bf');
  });

  it('runs one server pod with the server image at the chart version, no cluster', () => {
    const set = find(renderApplication(app), 'StatefulSet');
    assert.match(set, /\n {2}replicas: 1\n/);
    assert.ok(set.includes(`image: nats:${app.version}-alpine`));
    assert.doesNotMatch(find(renderApplication(app), 'ConfigMap'), /"cluster"/);
  });

  it('keeps the stream on a 10Gi retained volume and enables JetStream with a file store', () => {
    const output = renderApplication(app);
    const set = find(output, 'StatefulSet');
    assert.match(set, /storage: 10Gi\n\s+storageClassName: do-block-storage-retain/);
    assert.match(find(output, 'ConfigMap'), /"store_dir": "\/data"/);
  });

  it('exposes the broker inside the cluster only', () => {
    const service = find(renderApplication(app), 'Service');
    assert.doesNotMatch(service, /type: (LoadBalancer|NodePort)/);
    assert.match(service, /port: 4222/);
  });

  it('puts the pod hardening inside the pod spec, not beside it', () => {
    const set = find(renderApplication(app), 'StatefulSet');
    const spec = set.slice(set.indexOf('    spec:\n'));
    assert.match(spec, /automountServiceAccountToken: false/);
    assert.match(spec, /seccompProfile:\n\s+type: RuntimeDefault/);
    assert.match(spec, /allowPrivilegeEscalation: false/);
  });
});

describe('traefik Application (ADR-038, backlog TRAEFIK-1)', () => {
  const [app] = readChartApplications(`${deploy}/argocd`).filter(
    (item) => item.chart === 'traefik',
  );
  const source = readFileSync(`${deploy}/argocd/traefik.yaml`, 'utf8');
  const middleware = 'traefik-security-headers@kubernetescrd';

  it('pins an exact chart version and installs into its own namespace', () => {
    assert.ok(app, 'deploy/argocd has a traefik Application');
    assert.match(app.version, /^\d+\.\d+\.\d+$/);
    assert.equal(app.namespace, 'traefik');
    assert.match(source, /- CreateNamespace=true/);
  });

  it('runs two replicas with requests and no limits, under the chart default hardening', () => {
    const set = find(renderApplication(app), 'Deployment');
    assert.match(set, /\n {2}replicas: 2\n/);
    assert.match(
      set,
      /resources:\n\s+requests:\n\s+cpu: 100m\n\s+memory: 128Mi\n\s+securityContext:/,
    );
    assert.match(set, /allowPrivilegeEscalation: false/);
    assert.match(set, /readOnlyRootFilesystem: true/);
    assert.match(set, /runAsNonRoot: true/);
    assert.match(set, /seccompProfile:\n\s+type: RuntimeDefault/);
    assert.doesNotMatch(set, /--accesslog/, 'access logs stay off (ADR-043 item 4)');
  });

  it('trusts X-Forwarded-* only from the VPC and sets no PROXY protocol, on both entrypoints', () => {
    const args = find(renderApplication(app), 'Deployment');
    for (const entrypoint of ['web', 'websecure']) {
      assert.ok(
        args.includes(`--entryPoints.${entrypoint}.forwardedHeaders.trustedIPs=10.118.0.0/20`),
        `${entrypoint} trusts the VPC range`,
      );
    }
    assert.doesNotMatch(args, /proxyProtocol/);
    assert.doesNotMatch(args, /forwardedHeaders\.insecure/);
  });

  it('takes plain http from the balancer on websecure and attaches the headers to both entrypoints', () => {
    const args = find(renderApplication(app), 'Deployment');
    assert.doesNotMatch(args, /--entryPoints\.websecure\.http\.tls/);
    for (const entrypoint of ['web', 'websecure']) {
      assert.ok(args.includes(`--entryPoints.${entrypoint}.http.middlewares=${middleware}`));
    }
  });

  it('renders the headers Middleware that the entrypoints name, with the values of ADR-038', () => {
    const found =
      docs(renderApplication(app)).find(
        (doc) => kindOf(doc) === 'Middleware' && /name: security-headers/.test(doc),
      ) ?? '';
    assert.match(found, /namespace: traefik\n/);
    assert.match(found, /stsSeconds: 31536000/);
    assert.match(found, /forceSTSHeader: true/);
    assert.match(found, /contentTypeNosniff: true/);
    assert.match(found, /referrerPolicy: strict-origin-when-cross-origin/);
    assert.match(found, /frameDeny: true/);
    assert.doesNotMatch(found, /stsPreload|stsIncludeSubdomains/);
  });

  it('asks DigitalOcean for TLS on the balancer, http behind it and a redirect', () => {
    const service = find(renderApplication(app), 'Service');
    assert.match(service, /type: LoadBalancer/);
    assert.match(service, /do-loadbalancer-certificate-id: \S+/);
    assert.match(service, /do-loadbalancer-protocol: http\n/);
    assert.match(service, /do-loadbalancer-tls-ports: "443"/);
    assert.match(service, /do-loadbalancer-redirect-http-to-https: "true"/);
  });

  it('serves the IngressClass that the app chart names by default', () => {
    assert.match(find(renderApplication(app), 'IngressClass'), /\n {2}name: traefik\n/);
  });
});
