// Behaviour of the shared chart deploy/charts/app (ADR-019): what it renders, and what it refuses.
// Runs `helm template`, so Helm is a local requirement (AGENTS.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { readChartApplications, renderApplication } from './lib/argocd-application.ts';
import { run, type Sealer, type SealRequest } from './seal-secret.ts';

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
const all = (output: string, kind: string) => docs(output).filter((doc) => kindOf(doc) === kind);
const named = (output: string, kind: string, name: string) =>
  all(output, kind).find((doc) => new RegExp(`^ {2}name: ${name}$`, 'm').test(doc)) ?? '';
const checksum = (output: string, annotation = 'secret') =>
  new RegExp(`checksum/${annotation}: (\\w+)`).exec(find(output, 'Deployment'))?.[1];
const wave = (doc: string) => Number(/argocd\.argoproj\.io\/sync-wave: "(-?\d+)"/.exec(doc)?.[1]);
// The Secrets a pod template reads whole as environment, in order.
const envFromNames = (doc: string) =>
  [...doc.matchAll(/secretRef:\n\s+name: (\S+)/g)].map((match) => match[1]);
const envNames = (doc: string) =>
  [...doc.matchAll(/- name: ([A-Z_]+)\n\s+value:/g)].map((match) => match[1]);
const DB_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_SCHEMA',
  'DB_SSL_MODE',
  'DB_USER',
  'DB_PASSWORD',
];

describe('app chart: what it renders', () => {
  it('renders a Deployment, a Service and a ServiceAccount from an image alone', () => {
    assert.deepEqual(kinds(render([minimal])), [
      'Deployment',
      'NetworkPolicy',
      'Service',
      'ServiceAccount',
    ]);
  });

  it('renders every optional object when its feature is on', () => {
    assert.deepEqual(kinds(render([full])), [
      'ConfigMap',
      'CronJob',
      'Deployment',
      'Ingress',
      'Job',
      'NetworkPolicy',
      'SealedSecret',
      'SealedSecret',
      'SealedSecret',
      'Service',
      'ServiceAccount',
    ]);
  });

  it('orders the first rollout: secrets, CA and account, then the migration Job, then the workloads (ADR-047)', () => {
    const output = render([full]);
    const job = find(output, 'Job');
    assert.match(job, /argocd\.argoproj\.io\/hook: Sync\n/);
    assert.match(job, /argocd\.argoproj\.io\/hook-delete-policy: BeforeHookCreation/);
    assert.doesNotMatch(output, /hook: PreSync/, 'PreSync runs before wave -1 exists');
    const secrets = all(output, 'SealedSecret');
    assert.equal(secrets.length, 3, 'the main secret and both extraSecrets entries');
    const early = [...secrets, find(output, 'ConfigMap'), find(output, 'ServiceAccount')];
    assert.deepEqual(
      early.map(wave),
      [-1, -1, -1, -1, -1],
      'three SealedSecrets, the CA, the account',
    );
    assert.equal(wave(job), 0);
    assert.deepEqual(
      ['Deployment', 'CronJob'].map((kind) => wave(find(output, kind))),
      [1, 1],
    );
    assert.equal(
      docs(output).filter((doc) => /hook:/.test(doc)).length,
      1,
      'only the Job is a hook',
    );
  });

  it('renders every extraSecrets entry as <release>-<name>-secrets with strict scope', () => {
    const output = render([full]);
    for (const [name, key] of [
      ['web-secrets', 'OPENAI_API_KEY'],
      ['web-migrator-secrets', 'DB_PASSWORD'],
      ['web-reports-secrets', 'REPORTS_TOKEN'],
    ]) {
      const doc = named(output, 'SealedSecret', name);
      assert.ok(doc, `${name} is rendered`);
      assert.match(doc, /namespace: apps\n/);
      assert.match(doc, new RegExp(`\\n {4}${key}: AgB`));
      assert.match(doc, new RegExp(`template:\\n {4}metadata:\\n {6}name: ${name}\\n`));
    }
    assert.doesNotMatch(named(output, 'SealedSecret', 'web-secrets'), /REPORTS_TOKEN/);
  });

  it('gives the Deployment and the CronJob the app secret and the named ones, never the migrator secret', () => {
    const output = render([full]);
    for (const kind of ['Deployment', 'CronJob']) {
      assert.deepEqual(envFromNames(find(output, kind)), ['web-secrets', 'shared-config'], kind);
    }
  });

  it('gives the migration Job the migrator secret only, not the app secret and not envFromSecrets', () => {
    const job = find(render([full]), 'Job');
    assert.deepEqual(envFromNames(job), ['web-migrator-secrets']);
    assert.ok(envNames(job).includes('LOG_LEVEL'), 'the plain env still reaches the Job');
  });

  it('attaches an extraSecrets entry other than migrator only when envFromSecrets names it', () => {
    const output = render([full], ['envFromSecrets[1]=web-reports-secrets']);
    const expected = ['web-secrets', 'shared-config', 'web-reports-secrets'];
    assert.deepEqual(envFromNames(find(output, 'Deployment')), expected);
    assert.deepEqual(envFromNames(find(output, 'CronJob')), expected);
    assert.deepEqual(
      envFromNames(find(output, 'Job')),
      ['web-migrator-secrets'],
      'the Job never reads envFromSecrets',
    );
  });

  it('renders the CA as a ConfigMap and mounts it read-only in all three workloads (ADR-053 item 5)', () => {
    const output = render([full]);
    const map = find(output, 'ConfigMap');
    assert.match(map, /name: web-db-ca\n/);
    assert.match(map, /ca\.crt: \|\n {4}-----BEGIN CERTIFICATE-----\n/);
    for (const kind of ['Deployment', 'CronJob', 'Job']) {
      const doc = find(output, kind);
      assert.match(doc, /name: DB_SSL_CA_FILE\n\s+value: "\/etc\/bf\/db-ca\/ca\.crt"/, kind);
      assert.match(doc, /mountPath: \/etc\/bf\/db-ca\n\s+readOnly: true/, kind);
      assert.match(doc, /configMap:\n\s+name: web-db-ca\n/, kind);
    }
  });

  it('renders no ConfigMap, no mount and no CA variable for an application without a database', () => {
    const output = render([minimal]);
    assert.ok(!kinds(output).includes('ConfigMap'));
    assert.doesNotMatch(output, /db-ca|DB_SSL_CA_FILE/);
  });

  it('renders only what an application with a secret and no database asks for', () => {
    const output = render([minimal], ['secret.encryptedData.API_KEY=AgBplain']);
    assert.deepEqual(kinds(output), [
      'Deployment',
      'NetworkPolicy',
      'SealedSecret',
      'Service',
      'ServiceAccount',
    ]);
  });

  it('puts the seven DB_* names in each database secret of the fixture and DATABASE_URL nowhere', () => {
    const output = render([full]);
    for (const name of ['web-secrets', 'web-migrator-secrets']) {
      const doc = named(output, 'SealedSecret', name);
      for (const key of DB_KEYS) {
        assert.match(doc, new RegExp(`\\n {4}${key}: `), `${name} ${key}`);
      }
    }
    assert.doesNotMatch(output, /DATABASE_URL/);
  });

  it('never names doadmin: not in the values, not in a fixture, not in a rendered manifest (ADR-053 item 1)', () => {
    for (const file of [`${chart}/values.yaml`, minimal, full]) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /doadmin/i, file);
    }
    for (const output of [render([minimal]), render([full])]) {
      assert.doesNotMatch(output, /doadmin/i);
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

describe('app chart: restart hash in the Deployment', () => {
  it('has no hash when the application has no secret and no CA', () => {
    assert.equal(checksum(render([minimal])), undefined);
    assert.equal(checksum(render([minimal]), 'db-ca'), undefined);
  });

  it('keeps the hash for the same input', () => {
    assert.equal(checksum(render([full])), checksum(render([full])));
    assert.equal(checksum(render([full]), 'db-ca'), checksum(render([full]), 'db-ca'));
  });

  it('changes the hash when a sealed value of the app secret changes, so the pods restart', () => {
    const before = checksum(render([full]));
    const after = checksum(render([full], ['secret.encryptedData.DB_PASSWORD=AgBchanged']));
    assert.ok(before && after);
    assert.notEqual(before, after);
  });

  it('changes the CA hash when the CA changes, and leaves the secret hash alone', () => {
    const before = render([full]);
    const after = render([full], ['dbCa.pem=another certificate']);
    assert.ok(checksum(before, 'db-ca'));
    assert.notEqual(checksum(before, 'db-ca'), checksum(after, 'db-ca'));
    assert.equal(checksum(before), checksum(after));
  });

  it('keeps every hash when only the migrator secret changes: the Deployment does not get it', () => {
    const before = render([full]);
    const after = render([full], ['extraSecrets.migrator.encryptedData.DB_PASSWORD=AgBchanged']);
    assert.notEqual(
      named(before, 'SealedSecret', 'web-migrator-secrets'),
      named(after, 'SealedSecret', 'web-migrator-secrets'),
      'the change reaches the migrator secret',
    );
    assert.equal(checksum(before), checksum(after));
    assert.equal(checksum(before, 'db-ca'), checksum(after, 'db-ca'));
  });

  it('keeps every hash when only an unattached extra secret changes', () => {
    const before = render([full]);
    const after = render([full], ['extraSecrets.reports.encryptedData.REPORTS_TOKEN=AgBchanged']);
    assert.equal(checksum(before), checksum(after));
  });

  it('keeps the hash when something other than the secret or the CA changes', () => {
    const before = checksum(render([full]));
    const after = checksum(render([full], ['replicas=3', 'env.LOG_LEVEL=debug']));
    assert.equal(before, after);
  });

  it('puts no hash on the CronJob and the Job', () => {
    const output = render([full]);
    assert.doesNotMatch(find(output, 'CronJob'), /checksum\//);
    assert.doesNotMatch(find(output, 'Job'), /checksum\//);
  });
});

describe('app chart: ingress', () => {
  it('points an enabled ingress at the Traefik class unless told otherwise (ADR-038)', () => {
    assert.match(find(render([full]), 'Ingress'), /ingressClassName: traefik\n/);
    const other = find(render([full], ['ingress.className=other']), 'Ingress');
    assert.match(other, /ingressClassName: other\n/);
  });
});

describe('app chart: probes (ADR-080, backlog PROBE-1)', () => {
  const probes = (output: string) => {
    const deployment = find(output, 'Deployment');
    const probe = (name: string) =>
      new RegExp(`${name}:\\n\\s+httpGet:\\n\\s+path: (\\S+)\\n\\s+port: (\\S+)\\n`).exec(
        deployment,
      );
    return {
      readiness: probe('readinessProbe')?.slice(1),
      liveness: probe('livenessProbe')?.slice(1),
      containerPort: /containerPort: (\d+)/.exec(deployment)?.[1],
    };
  };

  it('probes the TCP port when the application sets no path', () => {
    const deployment = find(render([minimal]), 'Deployment');
    assert.match(deployment, /readinessProbe:\n\s+tcpSocket:\n\s+port: http\n/);
    assert.match(deployment, /livenessProbe:\n\s+tcpSocket:\n\s+port: http\n/);
  });

  for (const [app, path] of [
    ['backend', '/api/health'],
    ['frontend', '/healthz'],
  ]) {
    it(`gives ${app} HTTP probes on ${path}, on the named port that is 3000`, () => {
      const output = render([
        `${deploy}/apps/${app}/values.yaml`,
        `${deploy}/apps/${app}/image.yaml`,
      ]);
      const found = probes(output);
      assert.deepEqual(found.readiness, [path, 'http']);
      assert.deepEqual(found.liveness, [path, 'http']);
      assert.equal(found.containerPort, '3000');
      assert.doesNotMatch(find(output, 'Deployment'), /tcpSocket/);
    });
  }
});

describe('app chart: network policy (ADR-037 item 4, backlog CHART-3)', () => {
  const policy = (values: string[], set: string[] = []) =>
    find(render(values, set), 'NetworkPolicy');

  it('selects the pods of the release and restricts ingress only', () => {
    const doc = policy([minimal]);
    assert.match(
      doc,
      /podSelector:\n    matchLabels:\n      app\.kubernetes\.io\/name: web\n      app\.kubernetes\.io\/instance: web\n/,
    );
    assert.match(doc, /policyTypes:\n    - Ingress\n/);
    assert.doesNotMatch(doc, /Egress|egress:/);
  });

  it('admits nobody when there is no ingress and no neighbour', () => {
    const doc = policy([minimal]);
    assert.match(doc, /^ {2}ingress: \[\]$/m);
    assert.doesNotMatch(doc, /from:/);
  });

  it('admits the ingress controller namespace on the application port only when the ingress is on', () => {
    const doc = policy([full]);
    assert.match(doc, /kubernetes\.io\/metadata\.name: traefik\n/);
    assert.match(doc, /ports:\n {8}- protocol: TCP\n {10}port: 4000\n/);
    const off = policy([full], ['ingress.enabled=false']);
    assert.doesNotMatch(off, /kubernetes\.io\/metadata\.name/);
  });

  it('takes the controller namespace from the values', () => {
    const doc = policy([full], ['networkPolicy.ingressControllerNamespace=edge']);
    assert.match(doc, /kubernetes\.io\/metadata\.name: edge\n/);
  });

  it('passes the named neighbours through as peers', () => {
    const doc = policy([full]);
    assert.match(
      doc,
      /podSelector:\n {12}matchLabels:\n {14}app\.kubernetes\.io\/name: frontend\n/,
    );
    const alone = policy([minimal, full], ['ingress.enabled=false']);
    assert.match(alone, /app\.kubernetes\.io\/name: frontend/);
    assert.doesNotMatch(alone, /metadata\.name/);
  });

  it('is rendered by default and gone when switched off', () => {
    assert.ok(kinds(render([minimal])).includes('NetworkPolicy'));
    assert.ok(!kinds(render([full], ['networkPolicy.enabled=false'])).includes('NetworkPolicy'));
  });

  it('is applied before the workloads: no sync wave, so wave 0 against their wave 1 (ADR-047)', () => {
    const output = render([full]);
    assert.doesNotMatch(find(output, 'NetworkPolicy'), /sync-wave/);
    assert.match(find(output, 'Deployment'), /sync-wave: "1"/);
    assert.match(find(output, 'CronJob'), /sync-wave: "1"/);
  });
});

describe('app chart: what it refuses (ADR-061)', () => {
  const dbKeysText = DB_KEYS.join(', ');

  it('refuses the migration without the secret of role app', () => {
    const failure = renderFails([minimal], ['migration.enabled=true']);
    assert.match(failure, /migration\.enabled requires secret\.encryptedData/);
  });

  it('refuses the migration without extraSecrets.migrator', () => {
    const failure = renderFails([full], ['extraSecrets.migrator=null']);
    assert.match(failure, /migration\.enabled requires extraSecrets\.migrator\.encryptedData/);
  });

  it('refuses the migration without the CA', () => {
    assert.match(renderFails([full], ['dbCa.pem=']), /dbCa\.pem is required/);
  });

  // Built from nothing, so a key left out is absent and not a null that a values file left behind.
  const sets = (path: string, omit: string[] = []) =>
    DB_KEYS.filter((key) => !omit.includes(key)).map((key) => `${path}.${key}=AgBx`);
  const migration = ['migration.enabled=true', 'dbCa.pem=ca'];

  it('refuses a key that is absent or null as missing', () => {
    const base = [...migration, ...sets('extraSecrets.migrator.encryptedData')];
    render([minimal], [...base, ...sets('secret.encryptedData')]);
    const absent = renderFails([minimal], [...base, ...sets('secret.encryptedData', ['DB_HOST'])]);
    assert.match(absent, /secret\.encryptedData must carry all of .*; missing: DB_HOST\b/);
    const nulled = renderFails([full], ['secret.encryptedData.DB_HOST=null']);
    assert.match(nulled, /missing: DB_HOST\b/);
  });

  it('refuses a secret that has some DB_* keys but not all seven, naming the missing ones', () => {
    const app = renderFails([full], ['secret.encryptedData.DB_PORT=null']);
    assert.match(
      app,
      new RegExp(`secret\\.encryptedData must carry all of ${dbKeysText}; missing: DB_PORT\\b`),
    );
    const migrator = renderFails(
      [full],
      [
        'extraSecrets.migrator.encryptedData.DB_USER=null',
        'extraSecrets.migrator.encryptedData.DB_SSL_MODE=null',
      ],
    );
    assert.match(
      migrator,
      /extraSecrets\.migrator\.encryptedData must carry all of .*; missing: DB_SSL_MODE, DB_USER/,
    );
  });

  it('refuses another extra secret that holds a DB_* key, by the same rule', () => {
    const failure = renderFails([full], ['extraSecrets.reports.encryptedData.DB_HOST=AgBx']);
    assert.match(failure, /extraSecrets\.reports\.encryptedData must carry all of/);
    assert.match(
      failure,
      /missing: DB_PORT, DB_NAME, DB_SCHEMA, DB_SSL_MODE, DB_USER, DB_PASSWORD/,
    );
  });

  it('requires the CA for a database secret even without the migration', () => {
    const set = DB_KEYS.map((key) => `secret.encryptedData.${key}=AgBx`);
    assert.match(renderFails([minimal], set), /dbCa\.pem is required/);
    render([minimal], [...set, 'dbCa.pem=some certificate']);
  });

  it('requires nothing for an application with neither the migration nor a DB_* key', () => {
    render([minimal]);
    render(
      [minimal],
      ['secret.encryptedData.API_KEY=AgBx', 'extraSecrets.other.encryptedData.TOKEN=AgBx'],
    );
  });

  it('names keys only: no sealed value and no CA text reaches a refusal', () => {
    const failures = [
      renderFails([full], ['secret.encryptedData.DB_PORT=null']),
      renderFails([full], ['dbCa.pem=']),
      renderFails([full], ['extraSecrets.migrator=null']),
    ];
    for (const failure of failures) {
      assert.doesNotMatch(failure, /AgBexampleciphertext|BEGIN CERTIFICATE/);
    }
  });

  it('refuses a missing image tag', () => {
    assert.match(renderFails([minimal], ['image.tag=']), /image\.tag is required/);
  });

  it('refuses the latest tag', () => {
    assert.match(renderFails([minimal], ['image.tag=latest']), /not latest/);
  });

  it('refuses an enabled ingress without a host', () => {
    assert.match(renderFails([minimal], ['ingress.enabled=true']), /ingress\.host is required/);
  });

  it('refuses networkPolicy.allowFrom that is not a list', () => {
    const failure = renderFails([minimal], ['networkPolicy.allowFrom=frontend']);
    assert.match(failure, /networkPolicy\.allowFrom must be a list/);
  });

  it('refuses an empty peer in networkPolicy.allowFrom, which would admit every pod', () => {
    const failure = renderFails([minimal], ['networkPolicy.allowFrom[0]={}']);
    assert.match(failure, /networkPolicy\.allowFrom\[0\] must be a non-empty NetworkPolicyPeer/);
    const scalar = renderFails([minimal], ['networkPolicy.allowFrom[0]=frontend']);
    assert.match(scalar, /allowFrom\[0\] must be a non-empty NetworkPolicyPeer/);
  });

  it('does not check allowFrom when the policy is off', () => {
    render([minimal], ['networkPolicy.enabled=false', 'networkPolicy.allowFrom=frontend']);
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
    assert.match(service, /do-loadbalancer-certificate-name: malinina-ca\n/);
    assert.doesNotMatch(service, /do-loadbalancer-certificate-id/);
    assert.match(service, /do-loadbalancer-type: REGIONAL\n/);
    assert.match(service, /do-loadbalancer-protocol: http\n/);
    assert.match(service, /do-loadbalancer-tls-ports: "443"/);
    assert.match(service, /do-loadbalancer-redirect-http-to-https: "true"/);
  });

  it('keeps one pod through a drain, spreads the two over nodes, logs JSON and exposes no metrics (TRAEFIK-3)', () => {
    const rendered = renderApplication(app);
    const budget = find(rendered, 'PodDisruptionBudget');
    assert.match(budget, /maxUnavailable: 1\n/);
    const set = find(rendered, 'Deployment');
    assert.match(
      set,
      /topologyKey: kubernetes\.io\/hostname\n\s+whenUnsatisfiable: ScheduleAnyway/,
    );
    // The spread selects the pods the chart labels, or it spreads nothing.
    assert.match(
      set,
      /labelSelector:\n\s+matchLabels:\n\s+app\.kubernetes\.io\/instance: traefik-traefik\n\s+app\.kubernetes\.io\/name: traefik/,
    );
    assert.match(set, /app\.kubernetes\.io\/instance: traefik-traefik\n/);
    assert.ok(set.includes('--log.format=json'));
    assert.ok(set.includes('--log.level=INFO'));
    assert.doesNotMatch(rendered, /--metrics|9100|prometheus\.io/, 'metrics stay off until MON-1');
  });

  it('serves the IngressClass that the app chart names by default', () => {
    assert.match(find(renderApplication(app), 'IngressClass'), /\n {2}name: traefik\n/);
  });
});

describe('ArgoCD self-management (ADR-019, ADR-046, backlog ARGOCD-1)', () => {
  const dir = `${deploy}/argocd`;
  const [app] = readChartApplications(dir).filter((item) => item.chart === 'argo-cd');
  const argoSource = readFileSync(`${dir}/argo-cd.yaml`, 'utf8');
  const rootSource = readFileSync(`${dir}/root.yaml`, 'utf8');
  const exclude = /exclude: "\{([^}]*)\}"/.exec(rootSource)?.[1].split(',') ?? [];
  const repoURL = 'https://github.com/FreyDv/bf';

  it('pins an exact chart version, takes the values file of this repository and keeps the live release name', () => {
    assert.ok(app, 'deploy/argocd has an argo-cd Application');
    assert.equal(app.version, '10.11.6');
    assert.equal(app.namespace, 'argocd');
    assert.equal(app.releaseName, 'argocd');
    assert.deepEqual(app.valueFiles, [`${dir}/argocd-values.yaml`]);
    assert.equal(app.values, '', 'no inline values: the file is the one source');
    assert.match(
      argoSource,
      new RegExp(`- repoURL: ${repoURL}\\n\\s+targetRevision: main\\n\\s+ref: values`),
    );
  });

  it('renders the objects the live release has, under the names kubectl and the runbook use', () => {
    const output = renderApplication(app);
    for (const name of ['argocd-server', 'argocd-repo-server', 'argocd-application-controller']) {
      assert.match(output, new RegExp(`\\n {2}name: ${name}\\n`), `${name} is rendered`);
    }
    assert.doesNotMatch(output, /name: argocd-argo-cd/);
    assert.match(find(output, 'Service'), /namespace: argocd\n/);
  });

  it('takes the replica counts from the values file', () => {
    const deployments = docs(renderApplication(app)).filter((doc) => kindOf(doc) === 'Deployment');
    const server = deployments.find((doc) => /name: argocd-server\n/.test(doc)) ?? '';
    const repo = deployments.find((doc) => /name: argocd-repo-server\n/.test(doc)) ?? '';
    assert.match(server, /\n {2}replicas: 2\n/);
    assert.match(repo, /\n {2}replicas: 2\n/);
    assert.match(server, /ARGOCD_API_SERVER_REPLICAS\n\s+value: "2"/);
  });

  it('leaves the CRDs and argocd-secret out of the sync, so self-sync cannot touch them', () => {
    const output = renderApplication(app);
    assert.ok(!kinds(output).includes('CustomResourceDefinition'), 'CRDs stay outside Helm');
    assert.doesNotMatch(output, /\n {2}name: argocd-secret\n/, 'the admin password hash stays');
  });

  it('syncs automatically but never prunes, never self-heals and never deletes what it deployed', () => {
    for (const source of [argoSource, rootSource]) {
      assert.match(source, /automated:\n\s+(#.*\n\s+)*prune: false\n/);
      assert.match(source, /- ServerSideApply=true/);
      assert.doesNotMatch(source, /^\s*selfHeal:\s*true/m);
      assert.doesNotMatch(source, /^\s*-?\s*resources-finalizer|finalizers:/m);
    }
  });

  it('points the root Application at this directory of the public repository, without credentials', () => {
    assert.match(
      rootSource,
      new RegExp(`repoURL: ${repoURL}\\n\\s+targetRevision: main\\n\\s+path: deploy/argocd\\n`),
    );
    assert.match(rootSource, /directory:\n\s+recurse: false\n/);
    assert.doesNotMatch(rootSource + argoSource, /secretRef|usernameSecret|password:|token:/);
  });

  it('applies every file of deploy/argocd as an Application, except the ones the root excludes', () => {
    assert.deepEqual([...exclude].sort(), ['argocd-values.yaml']);
    const synced = readdirSync(dir).filter(
      (name) => name.endsWith('.yaml') && !exclude.includes(name),
    );
    assert.deepEqual(synced.sort(), [
      'argo-cd.yaml',
      'backend.yaml',
      'frontend.yaml',
      'nats.yaml',
      'root.yaml',
      'sealed-secrets.yaml',
      'traefik.yaml',
    ]);
    for (const name of synced) {
      assert.match(
        readFileSync(`${dir}/${name}`, 'utf8'),
        /^kind: Application$/m,
        `${name} is an Application`,
      );
    }
  });

  it('names the balancer certificate malinina-ca by name, never by id (TRAEFIK-2)', () => {
    const traefik = readFileSync(`${dir}/traefik.yaml`, 'utf8').replace(/^\s*#.*$/gm, '');
    assert.match(
      traefik,
      /^\s+service\.beta\.kubernetes\.io\/do-loadbalancer-certificate-name: malinina-ca$/m,
    );
    assert.doesNotMatch(
      traefik,
      /do-loadbalancer-certificate-id/,
      'the id annotation wins over the name and changes on every renewal',
    );
  });
});

// DEPLOY-1: the Applications of our own apps. The name is the Helm release, the directory of the app and the name
// the SealedSecrets are sealed for (ADR-060 item 7), so a mismatch breaks decryption with no error at render time.
describe('app Applications of deploy/argocd (DEPLOY-1, ADR-019, ADR-030, ADR-038, ADR-060)', () => {
  const dir = `${deploy}/argocd`;
  const repoRoot = resolve(deploy, '..');
  const own = readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => ({ name, source: readFileSync(`${dir}/${name}`, 'utf8') }))
    .filter(({ source }) => /^\s+path: deploy\/charts\/app$/m.test(source));
  const dirs = (path: string) =>
    readdirSync(path, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  const nameOf = (source: string) => /^metadata:\n\s+name: (\S+)$/m.exec(source)?.[1];

  it('has one per app: its name is the directory in apps/ and in deploy/apps/', () => {
    const names = own.map(({ source }) => nameOf(source)).sort();
    assert.deepEqual(names, dirs(`${repoRoot}/apps`));
    assert.deepEqual(names, dirs(`${deploy}/apps`));
    for (const { name, source } of own) {
      assert.equal(`${nameOf(source)}.yaml`, name, 'the file is named like the Application');
    }
  });

  it('reads one source of this repository: the shared chart and the value files of its own app, in order', () => {
    for (const { source } of own) {
      const app = nameOf(source);
      assert.match(
        source,
        /repoURL: https:\/\/github\.com\/FreyDv\/bf\n\s+targetRevision: main\n\s+path: deploy\/charts\/app\n/,
      );
      assert.match(source, /ignoreMissingValueFiles: true\n/);
      assert.deepEqual(
        [...source.matchAll(/^\s+- (\.\.\/\.\.\/apps\/\S+)$/gm)].map((match) => match[1]),
        ['values.yaml', 'image.yaml', 'secrets.yaml'].map((file) => `../../apps/${app}/${file}`),
      );
      assert.doesNotMatch(
        source,
        /valuesObject|releaseName|chart:/,
        'no inline values and no other release name',
      );
    }
  });

  it('deploys into bf, creates the namespace itself, prunes and self-heals (ADR-030 item 5)', () => {
    for (const { source } of own) {
      assert.match(
        source,
        /destination:\n\s+server: https:\/\/kubernetes\.default\.svc\n\s+namespace: bf\n/,
      );
      assert.match(source, /automated:\n\s+prune: true\n\s+selfHeal: true\n/);
      assert.match(source, /- CreateNamespace=true/);
    }
  });

  it('renders each app with the files its Application lists: no database objects, the ingress of ADR-038, a SHA tag', () => {
    const paths: Record<string, string> = { backend: '/api', frontend: '/' };
    for (const { source } of own) {
      const app = nameOf(source) as string;
      const files = ['values.yaml', 'image.yaml', 'secrets.yaml']
        .map((file) => `${deploy}/apps/${app}/${file}`)
        .filter((file) => existsSync(file));
      const output = execFileSync(
        'helm',
        ['template', app, chart, '--namespace', 'bf', ...files.flatMap((file) => ['-f', file])],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      assert.deepEqual(kinds(output), [
        'Deployment',
        'Ingress',
        'NetworkPolicy',
        'Service',
        'ServiceAccount',
      ]);
      assert.doesNotMatch(output, /DB_|db-ca|migrate/, 'DEPLOY-2 owns the database');
      const ingress = find(output, 'Ingress');
      assert.match(ingress, /ingressClassName: traefik\n/);
      assert.match(ingress, /- host: malinina\.ca\n/);
      assert.match(ingress, new RegExp(`- path: ${paths[app]}\\n\\s+pathType: Prefix\\n`));
      assert.match(output, new RegExp(`image: ghcr\\.io/freydv/bf-${app}:[0-9a-f]{40}\\n`));
    }
  });

  it('keeps image.yaml to the tag alone, which is all the tag job writes (ADR-030)', () => {
    for (const { source } of own) {
      const text = readFileSync(`${deploy}/apps/${nameOf(source)}/image.yaml`, 'utf8').replace(
        /^\s*#.*$/gm,
        '',
      );
      assert.match(text.trim(), /^image:\n\s+tag: [0-9a-f]{40}$/);
    }
  });
});

// The two halves of ADR-060 and ADR-061 meet here: what scripts/seal-secret.ts writes is what the chart reads.
describe('seal-secret output rendered by the chart (ADR-060, ADR-061)', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'charts-test-'));
  after(() => rmSync(scratch, { recursive: true, force: true }));

  const calls: SealRequest[] = [];
  const sealer: Sealer = {
    available: () => true,
    seal(value, request) {
      calls.push(request);
      const digest = createHash('sha256')
        .update(`${request.name}\n${request.namespace}\n${value}`)
        .digest('base64')
        .replaceAll(/[=+/]/g, 'x');
      return `AgB${digest.repeat(8)}`;
    },
  };

  // Dummy values only; the role is in each value so a mix-up would show.
  const envFile = (role: string) =>
    [
      ...DB_KEYS.map(
        (key) => `${key}=${key === 'DB_PORT' ? '5432' : `${role}-${key.toLowerCase()}`}`,
      ),
      ...(role === 'app' ? ['OPENAI_API_KEY=dummy-key'] : []),
    ].join('\n');

  it('renders the secrets.yaml of two env files as the two secrets of the Deployment and the Job', () => {
    const root = join(scratch, 'repo');
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    mkdirSync(join(root, 'deploy/sealed-secrets'), { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), '.env\n.env.*\n');
    execFileSync(
      'openssl',
      [
        ...['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(scratch, 'key.pem')],
        ...['-out', join(root, 'deploy/sealed-secrets/pub-cert.pem'), '-subj', '/', '-days', '2'],
      ],
      { stdio: 'ignore' },
    );
    writeFileSync(join(root, 'apps/web/.env.production'), `${envFile('app')}\n`);
    writeFileSync(join(root, 'apps/web/.env.migrator.production'), `${envFile('migrator')}\n`);
    const text: string[] = [];
    const code = run([], {
      cwd: join(root, 'apps/web'),
      root,
      sealer,
      now: new Date(),
      out: (line) => text.push(line),
      err: (line) => text.push(line),
    });
    assert.equal(code, 0, text.join('\n'));

    const values = join(scratch, 'values.yaml');
    writeFileSync(
      values,
      [
        'migration:',
        '  enabled: true',
        '  command: [node]',
        '  args: [dist/migrate.js]',
        'dbCa:',
        '  pem: |',
        '    -----BEGIN CERTIFICATE-----',
        '    placeholder',
        '    -----END CERTIFICATE-----',
        '',
      ].join('\n'),
    );
    const output = execFileSync(
      'helm',
      [
        ...['template', 'web', chart, '--namespace', 'bf', '-f', minimal, '-f', values],
        ...['-f', join(root, 'deploy/apps/web/secrets.yaml')],
      ],
      { encoding: 'utf8' },
    );

    // Every value the sealer saw comes back under the name and namespace it was sealed for (strict scope).
    assert.deepEqual(
      [...new Set(calls.map((call) => `${call.namespace}/${call.name}`))],
      ['bf/web-secrets', 'bf/web-migrator-secrets'],
    );
    for (const name of ['web-secrets', 'web-migrator-secrets']) {
      const doc = named(output, 'SealedSecret', name);
      assert.match(doc, /namespace: bf\n/);
      for (const key of DB_KEYS) {
        assert.match(doc, new RegExp(`\\n {4}${key}: AgB`), `${name} ${key}`);
      }
    }
    assert.deepEqual(envFromNames(find(output, 'Deployment')), ['web-secrets']);
    assert.deepEqual(envFromNames(find(output, 'Job')), ['web-migrator-secrets']);
    assert.doesNotMatch(output, /doadmin|DATABASE_URL|dummy-key|app-db_|migrator-db_/i);
  });
});
