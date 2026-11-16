// The role and grant files of bfdb (ADR-078, ADR-053) on a real Postgres that mirrors DigitalOcean: doadmin is not a
// superuser, and the roles migrator and app are created by the bootstrap superuser, as DigitalOcean creates them, so
// doadmin has no admin option on them. Proves the two files run twice, and that app reads and writes but never
// creates. Needs Docker; the image is the one compose.yaml runs (ADR-033).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const doadminFile = readFileSync(join(root, 'database/roles/01-as-doadmin.sql'), 'utf8');
const migratorFile = readFileSync(join(root, 'database/roles/02-as-migrator.sql'), 'utf8');
const image = /^\s+image:\s*(postgres:\S+)\s*$/m.exec(
  readFileSync(join(root, 'compose.yaml'), 'utf8'),
)?.[1];

const hasDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const container = `bf-db-roles-${process.pid}`;
const PASSWORD = 'roles_test_only';

const docker = (args: string[], input?: string) =>
  spawnSync('docker', args, { encoding: 'utf8', input });

/** Runs SQL as a role against a database; returns the exit status and the combined output. */
function psql(role: string, sql: string, database = 'bf') {
  const result = docker(
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${PASSWORD}`,
      container,
      'psql',
      '-X',
      '-q',
      '-A',
      '-t',
      '-h',
      '127.0.0.1',
      '-U',
      role,
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '-',
    ],
    sql,
  );
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

const ok = (role: string, sql: string, database?: string) => {
  const result = psql(role, sql, database);
  assert.equal(result.status, 0, result.out);
  return result.out.trim();
};
const refused = (role: string, sql: string, pattern: RegExp) => {
  const result = psql(role, sql);
  assert.notEqual(result.status, 0, `${role} was allowed: ${sql}`);
  assert.match(result.out, pattern);
};

describe(
  'the role and grant files of bfdb',
  { skip: hasDocker ? false : 'docker is not available' },
  () => {
    before(async () => {
      assert.ok(image, 'compose.yaml has no postgres image');
      const started = docker([
        'run',
        '-d',
        '--rm',
        '--name',
        container,
        '-e',
        `POSTGRES_PASSWORD=${PASSWORD}`,
        image,
      ]);
      assert.equal(started.status, 0, started.stderr);
      for (let attempt = 0; ; attempt += 1) {
        if (
          docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status ===
          0
        )
          break;
        if (attempt >= 60) throw new Error(`${image} did not become ready`);
        await new Promise((done) => setTimeout(done, 1000));
      }
      // The superuser stands in for DigitalOcean: doadmin as on bfdb, the two roles as `doctl databases user create`
      // leaves them, and the database bf owned by doadmin.
      ok(
        'postgres',
        `CREATE ROLE doadmin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD '${PASSWORD}';
       CREATE ROLE migrator LOGIN PASSWORD '${PASSWORD}';
       CREATE ROLE app LOGIN PASSWORD '${PASSWORD}';
       CREATE DATABASE bf OWNER doadmin;`,
        'postgres',
      );
    });

    after(() => {
      docker(['rm', '-f', container]);
    });

    it("runs both files twice; bf stays doadmin's when doadmin cannot act as migrator", () => {
      for (let run = 0; run < 2; run += 1) {
        assert.match(ok('doadmin', doadminFile), /bf\|doadmin\|/);
        ok('migrator', migratorFile);
      }
    });

    it('puts what migrator creates with unqualified names into app', () => {
      ok('migrator', 'CREATE TABLE IF NOT EXISTS notes (id bigserial PRIMARY KEY, body text);');
      assert.equal(ok('migrator', "SELECT to_regclass('app.notes') IS NOT NULL;"), 't');
    });

    it('lets app read and write a table migrator made, sequence included, with no grant per table', () => {
      assert.equal(
        ok(
          'app',
          `SET search_path = app;
         INSERT INTO notes (body) VALUES ('a');
         UPDATE notes SET body = 'b' WHERE body = 'a';
         DELETE FROM notes WHERE body = 'b';
         SELECT count(*) FROM notes;`,
        ),
        '0',
      );
    });

    it('never lets app create: not in app, not in public, no schema, no temporary table', () => {
      refused('app', 'CREATE TABLE app.x (i int);', /permission denied for schema app/);
      refused('app', 'CREATE TABLE public.x (i int);', /permission denied for schema public/);
      refused('app', 'CREATE SCHEMA s;', /permission denied for database bf/);
      refused(
        'app',
        'CREATE TEMP TABLE t (i int);',
        /permission denied to create temporary tables/,
      );
    });

    it('keeps every other role out of bf', () => {
      ok('postgres', `CREATE ROLE stranger LOGIN PASSWORD '${PASSWORD}';`, 'postgres');
      refused('stranger', 'SELECT 1;', /permission denied for database "?bf"?/);
    });

    it('hands bf to migrator once doadmin may act as migrator', () => {
      ok('postgres', 'GRANT migrator TO doadmin;', 'postgres');
      assert.match(ok('doadmin', doadminFile), /bf\|migrator\|/);
      ok('postgres', 'REVOKE migrator FROM doadmin;', 'postgres');
    });

    it('refuses to start when app or migrator holds a dangerous attribute', () => {
      ok('postgres', 'ALTER ROLE app CREATEDB;', 'postgres');
      refused('doadmin', doadminFile, /SUPERUSER, CREATEROLE, CREATEDB, REPLICATION or BYPASSRLS/);
      ok('postgres', 'ALTER ROLE app NOCREATEDB;', 'postgres');
    });

    it('refuses the second file under another login', () => {
      refused('doadmin', migratorFile, /connect as migrator to bf/);
    });
  },
);
