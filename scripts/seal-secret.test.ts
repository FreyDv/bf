// Proves scripts/seal-secret.ts (ADR-020, ADR-060): strict reading of the env files, what is handed to kubeseal, what
// is written, and that no value leaks into an argument, a message or a file. The unit tests inject a fake kubeseal;
// one integration test runs the real kubeseal against a throwaway certificate and is skipped without it.
// Nothing here touches deploy/sealed-secrets/pub-cert.pem or any real secret: every repository is a temp directory
// and every value is a dummy.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  checkSecretsYaml,
  kubesealArgs,
  kubesealSealer,
  parseEnvStrict,
  run,
  SealError,
  type Context,
  type Sealer,
  type SealRequest,
} from './seal-secret.ts';

const hasKubeseal = spawnSync('kubeseal', ['--version'], { stdio: 'ignore' }).status === 0;
const hasOpenssl = spawnSync('openssl', ['version'], { stdio: 'ignore' }).status === 0;

const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'seal-secret-test-')));
let cert = '';

before(() => {
  assert.ok(hasOpenssl, 'openssl is needed to make the throwaway certificate');
  const key = join(scratch, 'key.pem');
  cert = join(scratch, 'cert.pem');
  // Self-signed with an empty subject, like the controller's own certificate; 4096 bits, like its key.
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:4096',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-subj',
      '/',
      '-days',
      '2',
    ],
    { stdio: 'ignore' },
  );
});
after(() => rmSync(scratch, { recursive: true, force: true }));

interface Call {
  value: string;
  request: SealRequest;
}

// Ciphertext-shaped and different per (value, name, namespace); the hash is not the value.
function fakeSealer(options: { failOnCall?: number; available?: boolean } = {}) {
  const calls: Call[] = [];
  const sealer: Sealer = {
    available: () => options.available ?? true,
    seal(value, request) {
      calls.push({ value, request });
      if (calls.length === options.failOnCall) throw new SealError('boom');
      const digest = createHash('sha256')
        .update(`${request.name}\n${request.namespace}\n${value}`)
        .digest('base64')
        .replaceAll('=', '');
      return `AgB${digest.repeat(8)}`;
    },
  };
  return { sealer, calls };
}

// A repository: git, an ignore rule for `.env.*`, the throwaway certificate, apps/backend.
function repository(): string {
  const root = mkdtempSync(join(scratch, 'repo-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  writeFileSync(join(root, '.gitignore'), '.env\n.env.*\n!.env.example\n');
  mkdirSync(join(root, 'deploy/sealed-secrets'), { recursive: true });
  writeFileSync(join(root, 'deploy/sealed-secrets/pub-cert.pem'), readFileSync(cert));
  mkdirSync(join(root, 'apps/backend'), { recursive: true });
  return root;
}

function exec(root: string, argv: string[], sealer: Sealer, extra: Partial<Context> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, {
    cwd: join(root, 'apps/backend'),
    root,
    sealer,
    now: new Date(),
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...extra,
  });
  return { code, text: [...out, ...err].join('\n'), out, err };
}

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

const secretsFile = (root: string) => join(root, 'deploy/apps/backend/secrets.yaml');
const writeEnv = (root: string, name: string, body: string) =>
  writeFileSync(join(root, 'apps/backend', name), body);

const VALUES = ['dummy-alpha-1', 'dummy-beta-2', 'dummy-gamma-3'];
const GOOD = `# comment\nDUMMY_ONE=${VALUES[0]}\nDUMMY_TWO="${VALUES[1]}"\n\nDUMMY_THREE='${VALUES[2]}'\n`;

describe('strict env reading', () => {
  const refused: [string, string, RegExp][] = [
    ['a duplicate key', 'A=dummy1\nA=dummy2\n', /line 2: duplicate key A/],
    ['an empty value', 'A=\n', /line 1: empty value for A/],
    ['an empty quoted value', 'A=""\n', /line 1: empty value for A/],
    ['a lower case key', 'a=dummy1\n', /line 1: key must match/],
    ['a key with a space', 'BAD KEY=dummy1\n', /line 1: key must match/],
    ['an export prefix', 'export A=dummy1\n', /line 1: key must match/],
    ['a line without =', 'A=dummy1\njust-text\n', /line 2: not KEY=value/],
    ['an unquoted #', 'A=dummy#1\n', /line 1: unquoted # in the value of A/],
    ['a multiline value', 'A="dummy1\nline2"\n', /line 1: A is a multiline value/],
    ['a \\n escape', 'A="dummy1\\nline2"\n', /A: multiline value/],
    [
      'text after the closing quote',
      'A="dummy1" tail\n',
      /line 1: A is a multiline value or has text/,
    ],
    ['a quote inside quotes', `A="dummy'1"x"\n`, /line 1: A has a quote inside its quotes/],
    ['no keys', '# only a comment\n\n', /no keys/],
  ];
  for (const [name, source, pattern] of refused) {
    it(`refuses ${name}, naming the line and the key but no value`, () => {
      const { errors } = parseEnvStrict(source);
      assert.match(errors.join('\n'), pattern);
      assert.doesNotMatch(errors.join('\n'), /dummy/);
    });
  }

  it('reports every problem at once', () => {
    const { errors } = parseEnvStrict('A=\nB=x#y\nB2=\n');
    assert.equal(errors.length, 3);
  });

  it('reads quoted values with # and spaces literally, in file order', () => {
    const { entries, errors } = parseEnvStrict(
      'ZED="a#b c"\nALPHA=\'d#e\'\nMID=plain value\r\nTAIL=`q`\n',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(entries, [
      { key: 'ZED', value: 'a#b c' },
      { key: 'ALPHA', value: 'd#e' },
      { key: 'MID', value: 'plain value' },
      { key: 'TAIL', value: 'q' },
    ]);
  });
});

describe('app mode', () => {
  it('seals every key for <app>-secrets in namespace bf, strict scope, and rewrites secrets.yaml', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    const { sealer, calls } = fakeSealer();
    const result = exec(root, [], sealer);
    assert.equal(result.code, 0, result.text);
    assert.deepEqual(
      calls.map((call) => call.request.name),
      ['backend-secrets', 'backend-secrets', 'backend-secrets'],
    );
    assert.ok(calls.every((call) => call.request.namespace === 'bf'));
    assert.deepEqual(
      calls.map((call) => call.value),
      VALUES,
    );
    const yaml = readFileSync(secretsFile(root), 'utf8');
    assert.match(
      yaml,
      /^# Generated.*\nsecret:\n {2}encryptedData:\n {4}DUMMY_ONE: AgB\S+\n {4}DUMMY_TWO: AgB\S+\n {4}DUMMY_THREE: AgB\S+\n$/,
    );
    assert.deepEqual(checkSecretsYaml(yaml, 'secrets.yaml'), []);

    // A second run replaces the whole file, it does not merge into it.
    writeEnv(root, '.env.production', 'ONLY_KEY=dummy-delta-4\n');
    assert.equal(exec(root, [], fakeSealer().sealer).code, 0);
    const again = readFileSync(secretsFile(root), 'utf8');
    assert.doesNotMatch(again, /DUMMY_ONE/);
    assert.match(again, /ONLY_KEY/);
  });

  it('hands kubeseal the cert, strict scope, name and namespace in argv, and the value only on stdin', () => {
    const args = kubesealArgs({
      name: 'backend-secrets',
      namespace: 'bf',
      cert: '/x/pub-cert.pem',
    });
    assert.deepEqual(args, [
      '--raw',
      '--cert',
      '/x/pub-cert.pem',
      '--scope',
      'strict',
      '--name',
      'backend-secrets',
      '--namespace',
      'bf',
    ]);
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    const { sealer, calls } = fakeSealer();
    exec(root, [], sealer);
    for (const call of calls) {
      assert.ok(
        !kubesealArgs(call.request).some((arg) => VALUES.some((value) => arg.includes(value))),
      );
    }
  });

  it('puts every .env.<name>.production into its own secret under extraSecrets.<name>', () => {
    const root = repository();
    writeEnv(root, '.env.production', 'APP_KEY=dummy-app-1\n');
    writeEnv(root, '.env.migrator.production', 'MIGRATOR_KEY=dummy-mig-2\n');
    writeEnv(root, '.env.local', 'NOT_SEALED=dummy-local-3\n');
    const { sealer, calls } = fakeSealer();
    const result = exec(root, [], sealer);
    assert.equal(result.code, 0, result.text);
    assert.deepEqual(
      calls.map((call) => [call.request.name, call.value]),
      [
        ['backend-secrets', 'dummy-app-1'],
        ['backend-migrator-secrets', 'dummy-mig-2'],
      ],
    );
    const yaml = readFileSync(secretsFile(root), 'utf8');
    assert.match(
      yaml,
      /\nsecret:\n {2}encryptedData:\n {4}APP_KEY: AgB\S+\nextraSecrets:\n {2}migrator:\n {4}encryptedData:\n {6}MIGRATOR_KEY: AgB\S+\n$/,
    );
    assert.doesNotMatch(yaml, /NOT_SEALED/);
    assert.deepEqual(checkSecretsYaml(yaml, 'secrets.yaml'), []);
  });

  it('fails clearly and writes nothing when .env.production is missing', () => {
    const root = repository();
    writeEnv(root, '.env.migrator.production', 'MIGRATOR_KEY=dummy-mig-2\n');
    const { sealer, calls } = fakeSealer();
    const result = exec(root, [], sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /apps\/backend\/\.env\.production does not exist/);
    assert.equal(calls.length, 0);
    assert.equal(existsSync(join(root, 'deploy/apps')), false);
  });

  it('refuses an env file that git does not ignore, and never reads it', () => {
    const root = repository();
    writeFileSync(join(root, '.gitignore'), '');
    writeEnv(root, '.env.production', GOOD);
    const { sealer, calls } = fakeSealer();
    const result = exec(root, [], sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /is not ignored by git/);
    assert.equal(calls.length, 0);
  });

  it('refuses a bad name between .env. and .production', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    writeEnv(root, '.env.Mig_Rator.production', 'A=dummy1\n');
    const result = exec(root, [], fakeSealer().sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /\.env\.Mig_Rator\.production: the name between/);
  });

  it('refuses a strict-scope-unsafe app name: over 40 characters or ending with "-"', () => {
    for (const name of ['a'.repeat(41), 'backend-']) {
      const root = repository();
      mkdirSync(join(root, 'apps', name));
      writeFileSync(join(root, 'apps', name, '.env.production'), 'A=dummy1\n');
      const { sealer, calls } = fakeSealer();
      const result = exec(root, [], sealer, { cwd: join(root, 'apps', name) });
      assert.equal(result.code, 1);
      assert.match(result.text, /cannot be a Helm release name/);
      assert.equal(calls.length, 0);
    }
    const root = repository();
    const name = 'a'.repeat(40);
    mkdirSync(join(root, 'apps', name));
    writeFileSync(join(root, 'apps', name, '.env.production'), 'A=dummy1\n');
    assert.equal(exec(root, [], fakeSealer().sealer, { cwd: join(root, 'apps', name) }).code, 0);
  });

  it('refuses to run outside apps/<app>', () => {
    const root = repository();
    const result = exec(root, [], fakeSealer().sealer, { cwd: root });
    assert.equal(result.code, 1);
    assert.match(result.text, /run it from an application directory/);
  });

  it('writes nothing and leaves no temp file when a later key fails, and keeps the old secrets.yaml', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    assert.equal(exec(root, [], fakeSealer().sealer).code, 0);
    const before = readFileSync(secretsFile(root), 'utf8');
    writeEnv(root, '.env.production', 'DUMMY_ONE=dummy-new-1\nDUMMY_TWO=dummy-new-2\n');
    const result = exec(root, [], fakeSealer({ failOnCall: 2 }).sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /sealing DUMMY_TWO for backend-secrets failed/);
    assert.equal(readFileSync(secretsFile(root), 'utf8'), before);
    assert.deepEqual(readdirSync(join(root, 'deploy/apps/backend')), ['secrets.yaml']);
  });

  it('writes nothing when any env file has a problem, and the message holds no value', () => {
    const root = repository();
    writeEnv(root, '.env.production', 'GOOD=dummy-ok-1\n');
    writeEnv(root, '.env.migrator.production', 'DUP=dummy-secret-2\nDUP=dummy-secret-3\n');
    const { sealer, calls } = fakeSealer();
    const result = exec(root, [], sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /\.env\.migrator\.production:\n {2}line 2: duplicate key DUP/);
    assert.doesNotMatch(result.text, /dummy-/);
    assert.equal(calls.length, 0);
    assert.equal(existsSync(join(root, 'deploy/apps')), false);
  });

  it('refuses when kubeseal is missing, the certificate is absent, malformed, expired or not yet valid', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    const missing = exec(root, [], fakeSealer({ available: false }).sealer);
    assert.match(missing.text, /kubeseal is not on PATH/);

    const day = 24 * 3600 * 1000;
    assert.match(
      exec(root, [], fakeSealer().sealer, { now: new Date(Date.now() + 30 * day) }).text,
      /has expired/,
    );
    assert.match(
      exec(root, [], fakeSealer().sealer, { now: new Date(Date.now() - 30 * day) }).text,
      /is not valid yet/,
    );
    writeFileSync(join(root, 'deploy/sealed-secrets/pub-cert.pem'), 'not a certificate\n');
    assert.match(exec(root, [], fakeSealer().sealer).text, /is not a certificate/);
    rmSync(join(root, 'deploy/sealed-secrets/pub-cert.pem'));
    assert.match(exec(root, [], fakeSealer().sealer).text, /does not exist/);
    assert.equal(existsSync(join(root, 'deploy/apps')), false);
  });

  it('prints, logs and writes no value anywhere', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    const result = exec(root, [], fakeSealer().sealer);
    assert.equal(result.code, 0);
    assert.match(
      result.text,
      /sealed backend-secrets \(3 keys\) into deploy\/apps\/backend\/secrets\.yaml/,
    );
    for (const file of files(root)) {
      if (file.includes('/.git/') || file.endsWith('/.env.production')) continue;
      const text = readFileSync(file, 'utf8');
      for (const value of VALUES) assert.ok(!text.includes(value), `${file} holds a value`);
    }
    for (const value of VALUES) assert.ok(!result.text.includes(value));
  });
});

describe('manifest mode', () => {
  const flags = (root: string, env: string, out = 'out/nats-secrets.yaml') => [
    '--env',
    env,
    '--name',
    'nats-auth',
    '--namespace',
    'nats',
    '--out',
    join(root, out),
  ];

  it('writes a strict-scope SealedSecret manifest for the given name and namespace', () => {
    const root = repository();
    writeFileSync(join(root, '.env.nats'), 'USER_PASSWORD=dummy-nats-1\nOTHER=dummy-nats-2\n');
    const { sealer, calls } = fakeSealer();
    const result = exec(root, flags(root, join(root, '.env.nats')), sealer);
    assert.equal(result.code, 0, result.text);
    assert.deepEqual(
      calls.map((call) => call.request.name + '/' + call.request.namespace),
      ['nats-auth/nats', 'nats-auth/nats'],
    );
    const yaml = readFileSync(join(root, 'out/nats-secrets.yaml'), 'utf8');
    assert.match(
      yaml,
      /\napiVersion: bitnami\.com\/v1alpha1\nkind: SealedSecret\nmetadata:\n {2}name: nats-auth\n {2}namespace: nats\n/,
    );
    assert.match(
      yaml,
      /\n {2}encryptedData:\n {4}USER_PASSWORD: AgB\S+\n {4}OTHER: AgB\S+\n {2}template:\n/,
    );
    assert.match(yaml, /\n {4}type: Opaque\n$/);
    assert.doesNotMatch(yaml, /scope|dummy-/);
  });

  it('refuses an env file git does not ignore (any name outside the ignore rules)', () => {
    const root = repository();
    writeFileSync(join(root, 'nats.secrets'), 'A=dummy1\n');
    const { sealer, calls } = fakeSealer();
    const result = exec(root, flags(root, join(root, 'nats.secrets')), sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /is not ignored by git/);
    assert.equal(calls.length, 0);
    assert.equal(existsSync(join(root, 'out')), false);
  });

  it('refuses an env file outside any repository', () => {
    const root = repository();
    const outside = mkdtempSync(join(scratch, 'outside-'));
    writeFileSync(join(outside, '.env.nats'), 'A=dummy1\n');
    const result = exec(root, flags(root, join(outside, '.env.nats')), fakeSealer().sealer);
    assert.equal(result.code, 1);
    assert.match(result.text, /is not ignored by git/);
  });

  it('refuses a bad name, a missing flag, an unknown flag, and applies the same strict parsing', () => {
    const root = repository();
    writeFileSync(join(root, '.env.nats'), 'A=dummy1\nA=dummy2\n');
    const env = join(root, '.env.nats');
    assert.match(exec(root, flags(root, env), fakeSealer().sealer).text, /duplicate key A/);
    writeFileSync(env, 'A=dummy1\n');
    const bad = flags(root, env);
    bad[3] = 'Bad_Name';
    assert.match(exec(root, bad, fakeSealer().sealer).text, /--name must be a Kubernetes name/);
    assert.match(exec(root, ['--env', env], fakeSealer().sealer).text, /usage:/);
    assert.match(exec(root, ['--bogus', 'x'], fakeSealer().sealer).text, /usage:/);
    assert.match(exec(root, ['--check', '--env', env], fakeSealer().sealer).text, /usage:/);
    assert.equal(existsSync(join(root, 'out')), false);
  });

  it('writes nothing when sealing fails halfway', () => {
    const root = repository();
    writeFileSync(join(root, '.env.nats'), 'A=dummy1\nB=dummy2\n');
    const result = exec(
      root,
      flags(root, join(root, '.env.nats')),
      fakeSealer({ failOnCall: 2 }).sealer,
    );
    assert.equal(result.code, 1);
    assert.equal(existsSync(join(root, 'out')), false);
  });
});

describe('--check', () => {
  const cipher = `AgB${'x'.repeat(400)}`;
  const good = `# header\nsecret:\n  encryptedData:\n    KEY_ONE: ${cipher}\nextraSecrets:\n  migrator:\n    encryptedData:\n      KEY_TWO: ${cipher}\n`;

  it('accepts what the script writes and fails on plaintext, naming file, line and key but not the value', () => {
    assert.deepEqual(checkSecretsYaml(good, 'f'), []);
    const errors = checkSecretsYaml(
      good.replace(`KEY_TWO: ${cipher}`, 'KEY_TWO: dummy-plain-1'),
      'f',
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /^f:8: KEY_TWO is not kubeseal ciphertext$/);
    assert.doesNotMatch(errors.join(), /dummy-plain/);
  });

  it('rejects short, quoted and non-base64 values and any other shape', () => {
    const bad = [
      good.replace(cipher, 'AgBshort'),
      good.replace(`KEY_ONE: ${cipher}`, `KEY_ONE: "${cipher}"`),
      good.replace(cipher, `AgB${'x'.repeat(400)} extra`),
      good.replace('secret:', 'secret: {}'),
      `${good}other: 1\n`,
      good.replace('  encryptedData:\n    KEY_ONE', '  data:\n    KEY_ONE'),
      '# header\nextraSecrets:\n  migrator:\n    encryptedData:\n      KEY_TWO: ' + cipher + '\n',
      '# header\nsecret:\n  encryptedData:\n',
      good + good.split('\n').slice(1, 4).join('\n') + '\n',
    ];
    for (const source of bad)
      assert.notDeepEqual(checkSecretsYaml(source, 'f'), [], source.slice(0, 80));
  });

  it('checks every deploy/apps/*/secrets.yaml of a root', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    assert.equal(exec(root, ['--check'], fakeSealer().sealer).code, 0);
    assert.equal(exec(root, [], fakeSealer().sealer).code, 0);
    const ok = exec(root, ['--check'], fakeSealer().sealer);
    assert.equal(ok.code, 0);
    assert.match(ok.text, /OK \(1 secrets\.yaml\)/);
    mkdirSync(join(root, 'deploy/apps/frontend'), { recursive: true });
    writeFileSync(
      join(root, 'deploy/apps/frontend/secrets.yaml'),
      'secret:\n  encryptedData:\n    TOKEN: dummy-plain-9\n',
    );
    const failed = exec(root, ['--check'], fakeSealer().sealer);
    assert.equal(failed.code, 1);
    assert.match(
      failed.text,
      /deploy\/apps\/frontend\/secrets\.yaml:3: TOKEN is not kubeseal ciphertext/,
    );
    assert.doesNotMatch(failed.text, /dummy-plain/);
  });

  it('needs neither kubeseal nor a certificate', () => {
    const root = repository();
    rmSync(join(root, 'deploy/sealed-secrets'), { recursive: true });
    assert.equal(exec(root, ['--check'], fakeSealer({ available: false }).sealer).code, 0);
  });
});

describe('real kubeseal', { skip: hasKubeseal ? false : 'skipped: kubeseal not on PATH' }, () => {
  it('seals with a throwaway certificate; --check accepts the file; no value is written anywhere', () => {
    const root = repository();
    writeEnv(root, '.env.production', GOOD);
    writeEnv(root, '.env.migrator.production', 'MIGRATOR_KEY=dummy-mig-9\n');
    const result = exec(root, [], kubesealSealer);
    assert.equal(result.code, 0, result.text);
    const yaml = readFileSync(secretsFile(root), 'utf8');
    assert.deepEqual(checkSecretsYaml(yaml, 'secrets.yaml'), []);
    assert.equal(exec(root, ['--check'], kubesealSealer).code, 0);
    // Strict scope makes the ciphertext depend on the name: the same key in two secrets differs.
    const first = kubesealSealer.seal('dummy-same-1', {
      name: 'a-secrets',
      namespace: 'bf',
      cert: join(root, 'deploy/sealed-secrets/pub-cert.pem'),
    });
    const second = kubesealSealer.seal('dummy-same-1', {
      name: 'b-secrets',
      namespace: 'bf',
      cert: join(root, 'deploy/sealed-secrets/pub-cert.pem'),
    });
    assert.notEqual(first, second);
    for (const value of [...VALUES, 'dummy-mig-9']) {
      assert.ok(!yaml.includes(value));
      assert.ok(!result.text.includes(value));
    }
  });

  it('reports a kubeseal failure by key only', () => {
    const root = repository();
    writeEnv(root, '.env.production', 'DUMMY_ONE=dummy-alpha-1\n');
    // A valid certificate for preflight, but a wrong path handed to kubeseal.
    const failing: Sealer = {
      available: () => true,
      seal: (value, request) =>
        kubesealSealer.seal(value, { ...request, cert: join(root, 'missing.pem') }),
    };
    const result = exec(root, [], failing);
    assert.equal(result.code, 1);
    assert.match(
      result.text,
      /sealing DUMMY_ONE for backend-secrets failed: kubeseal exited with status/,
    );
    assert.doesNotMatch(result.text, /dummy-alpha/);
    assert.equal(existsSync(secretsFile(root)), false);
  });
});
