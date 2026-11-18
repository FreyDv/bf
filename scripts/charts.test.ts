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
      'Middleware',
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

describe('app chart: rate limit (ADR-037, ADR-038 item 6, backlog INGRESS-1)', () => {
  const MIDDLEWARES = 'traefik.ingress.kubernetes.io/router.middlewares';

  it('renders a Traefik rateLimit Middleware before the Ingress and attaches it to the Ingress', () => {
    const output = render([full]);
    const middleware = named(output, 'Middleware', 'web-rate-limit');
    assert.match(middleware, /^apiVersion: traefik\.io\/v1alpha1$/m);
    assert.equal(wave(middleware), -1);
    assert.match(middleware, /rateLimit:\n\s+average: 10\n\s+burst: 30\n\s+period: 1s\n/);
    assert.match(
      find(output, 'Ingress'),
      new RegExp(`${MIDDLEWARES}: apps-web-rate-limit@kubernetescrd\n`),
    );
  });

  it('counts the client by the rightmost X-Forwarded-For entry, the one the balancer appended', () => {
    const middleware = find(render([full]), 'Middleware');
    assert.match(middleware, /sourceCriterion:\n\s+ipStrategy:\n(\s+#.*\n)*\s+depth: 1\n/);
  });

  it('renders no Middleware and no annotation when off or without an ingress', () => {
    assert.equal(find(render([minimal]), 'Middleware'), '');
    const off = render([full], ['ingress.rateLimit.enabled=false']);
    assert.equal(find(off, 'Middleware'), '');
    assert.doesNotMatch(find(off, 'Ingress'), new RegExp(MIDDLEWARES));
    assert.equal(find(render([full], ['ingress.enabled=false']), 'Middleware'), '');
  });

  it('keeps the other ingress annotations next to the one it writes', () => {
    const ingress = find(render([full], ['ingress.annotations.example=kept']), 'Ingress');
    assert.match(ingress, /example: kept\n/);
    assert.match(ingress, new RegExp(`${MIDDLEWARES}: apps-web-rate-limit@kubernetescrd`));
  });

  for (const app of ['backend', 'frontend']) {
    it(`limits ${app}, the public application on malinina.ca`, () => {
      const output = render([
        `${deploy}/apps/${app}/values.yaml`,
        `${deploy}/apps/${app}/image.yaml`,
      ]);
      assert.match(find(output, 'Middleware'), /average: [1-9]\d*\n\s+burst: [1-9]\d*\n/);
      assert.match(
        find(output, 'Ingress'),
        new RegExp(`${MIDDLEWARES}: apps-web-rate-limit@kubernetescrd`),
      );
    });
  }
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

  it('refuses a rate limit without a positive average and burst', () => {
    assert.match(
      renderFails([full], ['ingress.rateLimit.burst=0']),
      /ingress\.rateLimit needs average and burst above 0/,
    );
  });

  it('refuses a middlewares annotation of its own while the rate limit is on', () => {
    assert.match(
      renderFails(
        [full],
        ['ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.middlewares=x'],
      ),
      /sets traefik\.ingress\.kubernetes\.io\/router\.middlewares while ingress\.rateLimit is on/,
    );
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

  it('runs the metrics exporter as a container of the server pod on 7777, named prom-metrics (MON-1)', () => {
    const set = find(renderApplication(app), 'StatefulSet');
    assert.match(set, /name: prom-exporter\n/);
    assert.match(set, /containerPort: 7777\n\s+name: prom-metrics\n/);
    assert.match(set, /http:\/\/localhost:8222\//, 'it reads the monitor port inside the pod');
  });

  describe('NetworkPolicy (ADR-081, backlog NATS-4)', () => {
    const output = renderApplication(app);
    const policies = all(output, 'NetworkPolicy');
    const policy = policies[0] ?? '';
    // The keys render sorted, so `ingress:` is followed by the pod selector.
    const ingress = /^ {2}ingress:\n([\s\S]*?)^ {2}podSelector:/m.exec(policy)?.[1] ?? '';

    it('renders exactly one policy, named nats, in the application namespace', () => {
      assert.equal(policies.length, 1);
      assert.match(policy, /^ {2}name: nats$/m);
      assert.match(policy, /^ {2}namespace: bf$/m);
    });

    it('selects the server pod by component, so nats-box and the test pod stay out', () => {
      assert.match(
        policy,
        /podSelector:\n\s+matchLabels:\n\s+app\.kubernetes\.io\/component: nats\n\s+app\.kubernetes\.io\/instance: nats\n\s+app\.kubernetes\.io\/name: nats\n/,
      );
    });

    it('restricts ingress only: no Egress type, no egress rules', () => {
      assert.match(policy, /policyTypes:\n\s+- Ingress\n(?!\s+- )/);
      assert.doesNotMatch(policy, /Egress|egress/);
    });

    // The rules render in the order of the values: the apps on 4222 first, then the metrics scrape on 7777 (ADR-083).
    const rules = ingress.split(/^ {2}- (?=from:)/m).filter((rule) => rule.includes('from:'));

    it('has two ingress rules that open 4222/TCP and 7777/TCP and nothing else', () => {
      assert.equal(rules.length, 2, 'two ingress rules');
      assert.deepEqual(
        [...ingress.matchAll(/- port: (\d+)\n\s+protocol: (\w+)/g)].map((m) => [m[1], m[2]]),
        [
          ['4222', 'TCP'],
          ['7777', 'TCP'],
        ],
      );
      assert.equal(ingress.match(/port:/g)?.length, 2);
    });

    it('opens the exporter port 7777 to the namespace monitoring alone, by the label Kubernetes sets (ADR-083)', () => {
      const [, scrape] = rules;
      assert.match(scrape, /port: 7777/);
      assert.match(
        scrape,
        /- namespaceSelector:\n\s+matchLabels:\n\s+kubernetes\.io\/metadata\.name: monitoring\n/,
      );
      assert.equal(
        scrape.match(/- (namespaceSelector|podSelector|ipBlock):/g)?.length,
        1,
        'one peer',
      );
      assert.doesNotMatch(scrape, /podSelector|ipBlock/);
    });

    it('admits exactly the backend and Debezium by label, and nats-box, to 4222, with no empty peer', () => {
      const from = rules[0].slice(rules[0].indexOf('from:'));
      assert.equal(from.match(/- podSelector:/g)?.length, 2, 'two peers');
      assert.doesNotMatch(from, /namespaceSelector|ipBlock|podSelector: ?\{\}/);
      assert.match(
        from,
        /- podSelector:\n\s+matchExpressions:\n\s+- key: app\.kubernetes\.io\/name\n\s+operator: In\n\s+values:\n\s+- backend\n\s+- debezium\n/,
      );
      assert.match(
        from,
        /- podSelector:\n\s+matchLabels:\n\s+app\.kubernetes\.io\/component: nats-box\n\s+app\.kubernetes\.io\/name: nats\n/,
      );
    });
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

  it('keeps one pod through a drain, spreads the two over nodes and logs JSON (TRAEFIK-3)', () => {
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
  });

  // MON-1, ADR-083: the metrics are on for the Prometheus of `monitoring`, and the port never reaches the balancer.
  it('serves Prometheus metrics on port 9100 named metrics, and lists that port on no Service (MON-1)', () => {
    const rendered = renderApplication(app);
    const set = find(rendered, 'Deployment');
    assert.ok(set.includes('--metrics.prometheus=true'));
    assert.ok(set.includes('--entryPoints.metrics.address=:9100/tcp'));
    assert.match(set, /containerPort: 9100\n\s+name: metrics\n/);
    for (const service of all(rendered, 'Service')) {
      assert.doesNotMatch(service, /9100/, 'the DigitalOcean balancer forwards only Service ports');
    }
    assert.doesNotMatch(find(rendered, 'Service'), /name: metrics/);
  });

  it('gives the Service a hostname in its status, so a pod reaches the balancer and its certificate (MON-1)', () => {
    assert.match(
      find(renderApplication(app), 'Service'),
      /do-loadbalancer-hostname: malinina\.ca\n/,
    );
  });

  it('serves the IngressClass that the app chart names by default', () => {
    assert.match(find(renderApplication(app), 'IngressClass'), /\n {2}name: traefik\n/);
  });
});

// MON-1, ADR-083: the metrics and alerts stack. `pnpm charts:test` renders each chart at its pinned version with the
// values of this repository, so these are properties of what the cluster would get.
describe('monitoring Applications (ADR-083, backlog MON-1)', () => {
  const dir = `${deploy}/argocd`;
  const applications = readChartApplications(dir);
  const byChart = (chartName: string) => {
    const item = applications.find((candidate) => candidate.chart === chartName);
    assert.ok(item, `deploy/argocd has an Application for ${chartName}`);
    return item;
  };
  const prometheus = byChart('prometheus');
  const blackbox = byChart('prometheus-blackbox-exporter');
  const grafana = byChart('grafana');
  const postgresExporter = byChart('prometheus-postgres-exporter');
  const sourceOf = (file: string) => readFileSync(`${dir}/${file}`, 'utf8');
  // The lines of a YAML block scalar (`key: |`) in a rendered document, with their common indent removed.
  const blockOf = (doc: string, key: string) => {
    const lines = doc.split('\n');
    const start = lines.findIndex((line) => new RegExp(`^ {2}${key}: \\|$`).test(line));
    assert.notEqual(start, -1, `${key} is in the document`);
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trim() !== '' && !line.startsWith('    ')) break;
      body.push(line.slice(4));
    }
    return body.join('\n');
  };
  const prometheusOutput = renderApplication(prometheus);
  const grafanaOutput = renderApplication(grafana);

  it('pins exact chart versions and puts the whole stack in the namespace monitoring, which it creates', () => {
    for (const item of [prometheus, blackbox, grafana, postgresExporter]) {
      assert.match(item.version, /^\d+\.\d+\.\d+$/);
      assert.equal(item.namespace, 'monitoring');
    }
    for (const file of [
      'prometheus.yaml',
      'blackbox-exporter.yaml',
      'grafana.yaml',
      'postgres-exporter.yaml',
    ]) {
      const source = sourceOf(file);
      assert.match(source, /- CreateNamespace=true/);
      assert.match(source, /prune: false\n/, `${file} never prunes what it deployed`);
    }
  });

  describe('Prometheus', () => {
    const server = named(prometheusOutput, 'Deployment', 'prometheus-server');

    it('keeps 15 days and at most 8GB, on a 10Gi retained volume (ADR-083)', () => {
      assert.ok(server.includes('--storage.tsdb.retention.time=15d'));
      assert.ok(server.includes('--storage.tsdb.retention.size=8GB'));
      assert.match(
        find(prometheusOutput, 'PersistentVolumeClaim'),
        /storageClassName: "do-block-storage-retain"/,
      );
      assert.match(find(prometheusOutput, 'PersistentVolumeClaim'), /storage: "10Gi"/);
      assert.match(
        server,
        /strategy:\n\s+type: Recreate/,
        'one volume, so the old pod stops first',
      );
    });

    it('installs the server, kube-state-metrics and node-exporter, and no Alertmanager or Pushgateway', () => {
      const names = all(prometheusOutput, 'Deployment').concat(all(prometheusOutput, 'DaemonSet'));
      const rendered = names.map((doc) => /^ {2}name: (\S+)$/m.exec(doc)?.[1]).sort();
      assert.deepEqual(rendered, [
        'prometheus-kube-state-metrics',
        'prometheus-prometheus-node-exporter',
        'prometheus-server',
      ]);
      assert.doesNotMatch(prometheusOutput, /alertmanager|pushgateway/i);
    });

    it('reads the cluster and writes nothing: every ClusterRole rule is get, list or watch', () => {
      const roles = all(prometheusOutput, 'ClusterRole');
      assert.equal(roles.length, 2, 'the server and kube-state-metrics');
      for (const role of roles) {
        assert.doesNotMatch(
          role,
          /\b(create|update|patch|delete|deletecollection|escalate|bind|impersonate)\b/,
        );
        assert.doesNotMatch(role, /verbs:\s*\[?\s*"?\*/);
      }
    });

    it('keeps kube-state-metrics away from Secrets and ConfigMaps (its default would list every Secret)', () => {
      const role =
        all(prometheusOutput, 'ClusterRole').find((doc) =>
          /name: prometheus-kube-state-metrics\n/.test(doc),
        ) ?? '';
      assert.ok(role, 'a ClusterRole for kube-state-metrics');
      assert.doesNotMatch(role, /secrets|configmaps/);
      assert.match(role, /- pods\n/);
    });

    it('makes node-exporter listen on the node address inside the VPC, not on every interface', () => {
      const set = find(prometheusOutput, 'DaemonSet');
      assert.match(set, /--web\.listen-address=\[\$\(HOST_IP\)\]:9100/);
      assert.match(set, /hostNetwork: true/);
      assert.match(set, /automountServiceAccountToken: false/);
    });

    it('asks for resources on every container and limits none (estimates, MON-2 replaces them)', () => {
      const workloads = [
        ...all(prometheusOutput, 'Deployment'),
        ...all(prometheusOutput, 'DaemonSet'),
        ...all(renderApplication(blackbox), 'Deployment'),
        ...all(grafanaOutput, 'Deployment'),
      ];
      assert.equal(workloads.length, 5);
      for (const doc of workloads) {
        const images = doc.match(/^\s+image: /gm)?.length ?? 0;
        assert.equal(
          doc.match(/^\s+requests:/gm)?.length ?? 0,
          images,
          'a requests block per container',
        );
        assert.doesNotMatch(doc, /^\s+limits:/m);
      }
    });

    it('scrapes ten named jobs, found by namespace, pod label and port name or a fixed address, and none by annotation', () => {
      const config = blockOf(
        named(prometheusOutput, 'ConfigMap', 'prometheus-server'),
        'prometheus.yml',
      );
      const jobs = [...config.matchAll(/^- job_name: (\S+)$/gm)].map((match) => match[1]).sort();
      assert.deepEqual(jobs, [
        'bfdb-do',
        'blackbox-tls',
        'kube-state-metrics',
        'kubernetes-nodes',
        'kubernetes-nodes-cadvisor',
        'nats',
        'node-exporter',
        'postgres-exporter',
        'prometheus',
        'traefik',
      ]);
      assert.doesNotMatch(config, /prometheus_io_scrape|prometheus_io_probe/);
      // The jobs of other namespaces name their namespace, so no job reads pods of the whole cluster.
      for (const ns of ['monitoring', 'traefik', 'bf'])
        assert.match(config, new RegExp(`- ${ns}\\n`));
    });

    it("reads bfdb's DigitalOcean endpoint over https with basic auth from files and the project's CA (ADR-086)", () => {
      const config = blockOf(
        named(prometheusOutput, 'ConfigMap', 'prometheus-server'),
        'prometheus.yml',
      );
      const start = config.indexOf('- job_name: bfdb-do');
      const job = config.slice(start, config.indexOf('\n- job_name:', start + 1));
      assert.match(job, /scheme: https/);
      assert.match(job, /username_file: \/etc\/bfdb-metrics\/username/);
      assert.match(job, /password_file: \/etc\/bfdb-metrics\/password/);
      assert.match(job, /ca_file: \/etc\/bfdb-ca\/ca\.crt/);
      assert.doesNotMatch(job, /insecure_skip_verify/);
      assert.match(job, /- bfdb-do-user-48015624-0\.i\.db\.ondigitalocean\.com:9273/);
    });

    it('probes the certificate of the balancer with the module tls_expiry, once a minute', () => {
      const config = blockOf(
        named(prometheusOutput, 'ConfigMap', 'prometheus-server'),
        'prometheus.yml',
      );
      const job = config.slice(
        config.indexOf('- job_name: blackbox-tls'),
        config.indexOf('- job_name: kube-state-metrics'),
      );
      assert.match(job, /module:\n\s+- tls_expiry/);
      assert.match(job, /- malinina\.ca:443/);
      assert.match(job, /scrape_interval: 1m/);
      assert.match(job, /replacement: blackbox-exporter\.monitoring\.svc:9115/);
    });
  });

  describe('postgres_exporter (ADR-086)', () => {
    const output = renderApplication(postgresExporter);
    const deployment = find(output, 'Deployment');

    it('logs in as monitor over the private host with verify-full, the password from the sealed Secret', () => {
      assert.match(
        deployment,
        /value: "private-bfdb-do-user-48015624-0\.i\.db\.ondigitalocean\.com:25060\/bf\?sslmode=verify-full&sslrootcert=\/etc\/bfdb-ca\/ca\.crt"/,
      );
      assert.match(deployment, /name: DATA_SOURCE_USER\n\s+value: monitor\n/);
      assert.match(deployment, /secretKeyRef:\n\s+name: bfdb-monitoring\n\s+key: DATA_SOURCE_PASS/);
      assert.match(deployment, /--exclude-databases=_dodb,template0,template1/);
      assert.match(deployment, /configMap:\n\s+name: bfdb-ca/);
    });

    it('runs without a service account token, as non-root with a read-only root, and asks for resources', () => {
      assert.match(deployment, /automountServiceAccountToken: false/);
      assert.match(deployment, /runAsNonRoot: true/);
      assert.match(deployment, /readOnlyRootFilesystem: true/);
      assert.match(deployment, /requests:\n\s+cpu: 10m\n\s+memory: 32Mi/);
      assert.doesNotMatch(output, /kind: (Cluster)?Role/);
    });

    it('takes the Secret and the CA from a source of the prometheus Application, whose pod mounts two keys only', () => {
      assert.match(sourceOf('prometheus.yaml'), /path: deploy\/monitoring\/bfdb\n/);
      const server = named(prometheusOutput, 'Deployment', 'prometheus-server');
      assert.match(
        server,
        /items:\n\s+- key: DO_METRICS_USERNAME\n\s+path: username\n\s+- key: DO_METRICS_PASSWORD\n\s+path: password\n\s+secretName: bfdb-monitoring\n/,
      );
      assert.doesNotMatch(server, /DATA_SOURCE_PASS/);
    });

    it('has the dashboard Postgres in a provider of its own', () => {
      assert.match(grafanaOutput, /path: \/var\/lib\/grafana\/dashboards\/postgres/);
      const dashboard = JSON.parse(
        blockOf(named(grafanaOutput, 'ConfigMap', 'postgres-dashboard'), 'postgres.json'),
      ) as { title: string; panels: { targets: { expr: string; legendFormat?: string }[] }[] };
      assert.equal(dashboard.title, 'Postgres');
      const targets = dashboard.panels.flatMap((panel) => panel.targets);
      for (const target of targets) assert.match(target.expr, /job="postgres-exporter"/);
      assert.ok(
        targets.some((target) => target.legendFormat === '{{state}}'),
        'the escape of the template survives',
      );
    });
  });

  describe('blackbox exporter', () => {
    const output = renderApplication(blackbox);

    it('has one module, a bare TLS handshake, so a 404 or 5xx of the site cannot hide the certificate', () => {
      const config = find(output, 'ConfigMap');
      assert.match(config, /tls_expiry:\n\s+prober: tcp\n/);
      assert.match(config, /tls: true/);
      assert.doesNotMatch(config, /prober: http|http_2xx/);
      assert.equal(config.match(/prober:/g)?.length, 1);
    });

    it('is a ClusterIP Service named blackbox-exporter, with no Ingress', () => {
      assert.match(find(output, 'Service'), /name: blackbox-exporter\n/);
      assert.doesNotMatch(find(output, 'Service'), /LoadBalancer|NodePort/);
      assert.deepEqual(
        kinds(output).filter((kind) => kind === 'Ingress'),
        [],
      );
    });
  });

  describe('Grafana', () => {
    const deployment = find(grafanaOutput, 'Deployment');
    const ini = blockOf(named(grafanaOutput, 'ConfigMap', 'grafana'), 'grafana.ini');
    const valuesSource = readFileSync(`${deploy}/monitoring/grafana-values.yaml`, 'utf8');

    it('keeps its state on a 1Gi retained volume and stops the old pod before the new one starts', () => {
      const claim = find(grafanaOutput, 'PersistentVolumeClaim');
      assert.match(claim, /storage: "?1Gi"?/);
      assert.match(claim, /storageClassName: "?do-block-storage-retain"?/);
      assert.match(deployment, /strategy:\n\s+type: Recreate/);
    });

    it('reads every secret value from the sealed secret grafana-env, and the chart generates none', () => {
      assert.match(deployment, /envFrom:\n\s+- secretRef:\n\s+name: grafana-env\n/);
      assert.match(
        deployment,
        /name: GF_SECURITY_ADMIN_PASSWORD\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: grafana-env\n/,
      );
      assert.deepEqual(all(grafanaOutput, 'Secret'), []);
      assert.match(deployment, /automountServiceAccountToken: false/);
    });

    it('lets in only the one pre-created Google user: no sign-up, no login form', () => {
      assert.match(ini, /\[auth\]\ndisable_login_form = true\n/);
      assert.match(ini, /\[auth\.google\]\nallow_sign_up = false\nenabled = true\n/);
      assert.match(ini, /\[users\]\nallow_sign_up = false\n/);
      assert.match(ini, /root_url = https:\/\/log\.malinina\.ca\n/);
      assert.match(ini, /cookie_secure = true/);
      assert.match(ini, /content_security_policy = true/);
    });

    it('is public on its own subdomain through Traefik, behind a per-IP rate limit (ADR-083)', () => {
      const ingress = find(grafanaOutput, 'Ingress');
      assert.match(ingress, /ingressClassName: traefik/);
      assert.match(ingress, /host: "log\.malinina\.ca"/);
      assert.match(ingress, /router\.middlewares: "monitoring-grafana-rate-limit@kubernetescrd"/);
      assert.deepEqual(all(grafanaOutput, 'Ingress').length, 1);
      const limit = named(grafanaOutput, 'Middleware', 'grafana-rate-limit');
      assert.match(limit, /namespace: monitoring/);
      assert.match(limit, /depth: 1\n/);
      assert.match(limit, /sync-wave: "-1"/);
      assert.doesNotMatch(grafanaOutput, /LoadBalancer|NodePort/);
    });

    it('writes no credential and no e-mail address into the repository', () => {
      const code = valuesSource.replace(/^\s*#.*$/gm, '');
      assert.doesNotMatch(code, /client_secret|client_id\s*[:=]/i);
      assert.doesNotMatch(
        code,
        /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
        'the allowed user is created by hand',
      );
      assert.doesNotMatch(code, /\d{6,}:[A-Za-z0-9_-]{30,}/, 'a Telegram bot token has this shape');
      const contact = blockOf(named(grafanaOutput, 'ConfigMap', 'grafana'), 'contactpoints.yaml');
      assert.match(contact, /bottoken: \$\{TELEGRAM_BOT_TOKEN\}/);
      assert.match(contact, /chatid: \$\{TELEGRAM_CHAT_ID\}/);
    });

    it('provisions the Prometheus datasource, the eight alert rules and a Telegram policy from files', () => {
      const config = named(grafanaOutput, 'ConfigMap', 'grafana');
      assert.match(blockOf(config, 'datasources.yaml'), /uid: prometheus\n/);
      const rules = blockOf(config, 'rules.yaml');
      assert.deepEqual([...rules.matchAll(/^ {4}uid: (\S+)$/gm)].map((match) => match[1]).sort(), [
        'bfdb-connections-high',
        'bfdb-unreachable',
        'cert-expiry-critical',
        'cert-expiry-warning',
        'pod-restarting',
        'prometheus-down',
        'pvc-filling',
        'scrape-target-down',
      ]);
      assert.equal(rules.match(/datasourceUid: prometheus\n/g)?.length, 8);
      // 30 and 14 days for the certificate (ADR-083), and Prometheus itself failing is an alert, not an "Error".
      assert.match(rules, /params:\n\s+- 14\n\s+- 30\n\s+type: within_range/);
      assert.match(rules, /params:\n\s+- 14\n\s+type: lt/);
      assert.match(rules, /execErrState: Alerting/);
      assert.match(blockOf(config, 'policies.yaml'), /receiver: telegram-owner/);
    });

    it('provisions the consumption dashboard: CPU and memory by namespace, pod and node', () => {
      const dashboard = JSON.parse(
        blockOf(named(grafanaOutput, 'ConfigMap', 'consumption-dashboard'), 'consumption.json'),
      ) as {
        title: string;
        panels: {
          type: string;
          title: string;
          gridPos: { y: number };
          options?: { getOption: string };
          targets: { refId: string; expr: string; legendFormat: string }[];
        }[];
      };
      assert.equal(dashboard.title, 'Потребление');
      assert.equal(dashboard.panels.length, 9);
      const graphs = dashboard.panels.filter((panel) => panel.type === 'timeseries');
      assert.equal(graphs.length, 6);
      const exprs = graphs.map((panel) => panel.targets[0].expr).join('\n');
      for (const by of ['by (namespace)', 'by (namespace, pod)', 'by (node)'])
        assert.ok(exprs.includes(by));
      assert.ok(
        exprs.includes('container_cpu_usage_seconds_total') &&
          exprs.includes('node_memory_MemAvailable_bytes'),
      );
      assert.equal(
        dashboard.panels[0].targets[0].legendFormat,
        '{{namespace}}',
        'the escape of the template survives',
      );
    });

    it('draws the three utilisation gauges, one segment per part, every share of one capacity (ADR-084, ADR-085)', () => {
      const dashboard = JSON.parse(
        blockOf(named(grafanaOutput, 'ConfigMap', 'consumption-dashboard'), 'consumption.json'),
      ) as {
        panels: {
          type: string;
          title: string;
          gridPos: { x: number; y: number; w: number; h: number };
          options?: { getOption: string };
          targets: { refId: string; expr: string }[];
        }[];
      };
      const gauges = dashboard.panels.filter((panel) => panel.type === 'volkovlabs-echarts-panel');
      assert.deepEqual(
        gauges.map((gauge) => gauge.title),
        ['CPU', 'Память', 'Хранилище (тома)'],
      );
      // Stacked, one per row and the full width; the graphs below them.
      assert.deepEqual(
        gauges.map(({ gridPos }) => [gridPos.x, gridPos.w, gridPos.y]),
        [
          [0, 24, 0],
          [0, 24, gauges[0].gridPos.h],
          [0, 24, gauges[0].gridPos.h * 2],
        ],
      );
      const below = gauges[0].gridPos.h * 3;
      for (const graph of dashboard.panels.filter((panel) => panel.type === 'timeseries'))
        assert.ok(graph.gridPos.y >= below, 'the graphs sit below the gauges');

      const [cpu, memory, storage] = gauges.map((gauge) =>
        Object.fromEntries(gauge.targets.map((target) => [target.refId, target.expr])),
      );
      for (const query of [cpu, memory, storage])
        assert.deepEqual(Object.keys(query), ['capacity', 'groups', 'used']);
      // Reserved (requests) on the arc and used in the centre, never mixed: the capacity is allocatable, not raw.
      assert.match(cpu.capacity, /kube_node_status_allocatable\{resource="cpu"\}/);
      assert.match(
        cpu.groups,
        /^sum by \(namespace, pod\) \(kube_pod_container_resource_requests\{resource="cpu"\}/,
      );
      assert.match(cpu.groups, /kube_pod_status_phase\{phase="Running"\}/);
      assert.match(cpu.used, /container_cpu_usage_seconds_total/);
      assert.match(memory.groups, /kube_pod_container_resource_requests\{resource="memory"\}/);
      assert.match(memory.used, /container_memory_working_set_bytes/);
      assert.match(storage.capacity, /kubelet_volume_stats_capacity_bytes/);
      assert.match(
        storage.groups,
        /^sum by \(namespace, persistentvolumeclaim\) \(kubelet_volume_stats_used_bytes\)$/,
      );

      // The panel code itself, on data shaped like Grafana's frames: every part catches its pods, a pod no rule
      // names lands in "Прочее", Free is the rest, and the shares shown add up to exactly 100.0%.
      const frame = (refId: string, value: number, labels?: Record<string, string>) => ({
        refId,
        fields: [
          { type: 'time', values: [0] },
          { type: 'number', labels, values: [value] },
        ],
      });
      const pods: [string, string, number][] = [
        ['bf', 'frontend-6497d47bd-lgdb6', 0.5],
        ['bf', 'backend-6cd9cd589b-cwfj9', 0.5],
        ['bf', 'nats-0', 1],
        ['bf', 'debezium-server-0', 0.5],
        ['kube-system', 'cilium-5fqf9', 2],
        ['traefik', 'traefik-7d9c-abcde', 0.5],
        ['monitoring', 'prometheus-server-d8b79d56c-zn7hk', 0.5],
        ['monitoring', 'grafana-648d789c6d-xcbm4', 0.25],
        ['argocd', 'argocd-server-5d4f-xyz12', 0.25],
        ['default', 'stray-pod', 1],
      ];
      const theme = {
        isDark: true,
        visualization: { getColorByName: (name: string) => name },
        colors: { text: { primary: '#fff', secondary: '#ccc' }, background: { primary: '#111' } },
      };
      const run = new Function('context', gauges[0].options?.getOption ?? '') as (
        context: unknown,
      ) => {
        title: { text: string }[];
        series: { data: { name: string }[] }[];
      };
      const option = run({
        grafana: { theme },
        panel: {
          data: {
            series: [
              frame('capacity', 10),
              ...pods.map(([namespace, pod, value]) => frame('groups', value, { namespace, pod })),
              frame('used', 3),
            ],
          },
        },
      });
      const legend = option.title.slice(1).map((title) => title.text);
      const cell = (text: string) => text.match(/\{name\|([^}]+)\}\{pct\|([\d.]+)%\}/)?.slice(1);
      assert.deepEqual(
        legend.map((text) => cell(text)),
        [
          ['FE', '5.0'],
          ['BE', '5.0'],
          ['NATS', '10.0'],
          ['Debezium', '5.0'],
          ['kube', '20.0'],
          ['Traefik', '5.0'],
          ['Prometheus + экспортёры', '5.0'],
          ['Grafana', '2.5'],
          ['ArgoCD', '2.5'],
          ['Прочее', '10.0'],
          ['Free', '30.0'],
        ],
      );
      assert.match(
        option.title[0].text,
        /^\{big\|30%\}/,
        'the centre is what is used, not what is reserved',
      );
      assert.deepEqual(
        option.series[0].data.map((segment) => segment.name).slice(0, 2),
        ['Grafana', 'ArgoCD'],
        'the arc runs from the smallest part to the largest',
      );

      // One exact version, installed before start and never updated by Grafana itself (ADR-005).
      const config = named(grafanaOutput, 'ConfigMap', 'grafana');
      assert.match(config, /^ {2}plugins: volkovlabs-echarts-panel@7\.3\.0$/m);
      assert.match(config, /preinstall_auto_update = false/);
      assert.match(grafanaOutput, /name: GF_PLUGINS_PREINSTALL_SYNC/);
    });

    it('takes the sealed secret from its own directory and never holds a plain value there', () => {
      assert.match(sourceOf('grafana.yaml'), /path: deploy\/monitoring\/grafana-secret\n/);
      const secretDir = `${deploy}/monitoring/grafana-secret`;
      if (!existsSync(secretDir)) return; // sealed by hand before the merge (runbook "Мониторинг")
      const files = readdirSync(secretDir).filter((name) => name.endsWith('.yaml'));
      assert.ok(files.length > 0);
      for (const file of files) {
        const text = readFileSync(`${secretDir}/${file}`, 'utf8');
        assert.match(text, /^kind: SealedSecret$/m);
        assert.match(text, /^ {2}name: grafana-env$/m);
        assert.match(text, /^ {2}namespace: monitoring$/m);
        const values = [...text.matchAll(/^ {4}([A-Z_0-9]+): (\S+)$/gm)];
        assert.deepEqual(values.map((match) => match[1]).sort(), [
          'GF_AUTH_GOOGLE_CLIENT_ID',
          'GF_AUTH_GOOGLE_CLIENT_SECRET',
          'GF_SECURITY_ADMIN_PASSWORD',
          'TELEGRAM_BOT_TOKEN',
          'TELEGRAM_CHAT_ID',
        ]);
        for (const [, key, value] of values) {
          assert.match(value, /^A[gQ][A-Za-z0-9+/]{298,}={0,2}$/, `${key} is kubeseal ciphertext`);
        }
      }
    });
  });

  it('keeps the sealed login of bfdb and the public CA in deploy/monitoring/bfdb, no plain value (ADR-086)', () => {
    const bfdb = `${deploy}/monitoring/bfdb`;
    const sealed = readFileSync(`${bfdb}/bfdb-monitoring.yaml`, 'utf8');
    assert.match(sealed, /^kind: SealedSecret$/m);
    assert.match(sealed, /^ {2}name: bfdb-monitoring$/m);
    assert.match(sealed, /^ {2}namespace: monitoring$/m);
    const values = [...sealed.matchAll(/^ {4}([A-Z_0-9]+): (\S+)$/gm)];
    assert.deepEqual(values.map((match) => match[1]).sort(), [
      'DATA_SOURCE_PASS',
      'DO_METRICS_PASSWORD',
      'DO_METRICS_USERNAME',
    ]);
    for (const [, key, value] of values)
      assert.match(value, /^A[gQ][A-Za-z0-9+/]{298,}={0,2}$/, `${key} is kubeseal ciphertext`);
    const ca = readFileSync(`${bfdb}/bfdb-ca.yaml`, 'utf8');
    assert.match(ca, /^kind: ConfigMap$/m);
    assert.match(ca, /^ {2}name: bfdb-ca$/m);
    assert.match(ca, /^ {4}-----BEGIN CERTIFICATE-----$/m);
    assert.doesNotMatch(ca, /PRIVATE KEY/);
    assert.deepEqual(readdirSync(bfdb).sort(), ['bfdb-ca.yaml', 'bfdb-monitoring.yaml']);
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
      'blackbox-exporter.yaml',
      'frontend.yaml',
      'grafana.yaml',
      'nats.yaml',
      'postgres-exporter.yaml',
      'prometheus.yaml',
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

  it('renders each app with the files its Application lists: no database objects, the ingress of ADR-038 with its rate limit, a SHA tag', () => {
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
        'Middleware',
        'NetworkPolicy',
        'Service',
        'ServiceAccount',
      ]);
      assert.doesNotMatch(output, /DB_|db-ca|migrate/, 'DEPLOY-2 owns the database');
      const ingress = find(output, 'Ingress');
      assert.match(ingress, /ingressClassName: traefik\n/);
      // The name Traefik resolves: <namespace>-<Middleware name>@kubernetescrd (INGRESS-1).
      assert.match(
        ingress,
        new RegExp(
          `traefik\\.ingress\\.kubernetes\\.io/router\\.middlewares: bf-${app}-rate-limit@kubernetescrd\\n`,
        ),
      );
      assert.match(find(output, 'Middleware'), new RegExp(`^ {2}name: ${app}-rate-limit$`, 'm'));
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
