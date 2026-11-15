import { describe, expect, it } from 'vitest';
import { buildConnectionUrl, DbConfigError, readDbConfig, SSL_MODES } from './index.js';
import type { DbConfig } from './index.js';

const env = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_NAME: 'bf_test',
  DB_SCHEMA: 'public',
  DB_SSL_MODE: 'disable',
  DB_USER: 'someone',
  DB_PASSWORD: 'secret-value',
};

const fail = (values: Record<string, string | undefined>): DbConfigError => {
  try {
    readDbConfig(values);
  } catch (error) {
    if (error instanceof DbConfigError) return error;
    throw error;
  }
  throw new Error('readDbConfig was expected to throw');
};

describe('readDbConfig', () => {
  it('reads the seven fields', () => {
    expect(readDbConfig(env)).toEqual({
      host: '127.0.0.1',
      port: 5432,
      name: 'bf_test',
      schema: 'public',
      sslMode: 'disable',
      user: 'someone',
      password: 'secret-value',
    });
  });

  it('reads the optional CA file, and treats an empty one as absent', () => {
    expect(readDbConfig({ ...env, DB_SSL_CA_FILE: '/etc/bf/db-ca/ca.crt' }).sslCaFile).toBe(
      '/etc/bf/db-ca/ca.crt',
    );
    expect(readDbConfig({ ...env, DB_SSL_CA_FILE: '' })).not.toHaveProperty('sslCaFile');
  });

  it('reports every missing name at once', () => {
    const error = fail({});
    expect(error.missing).toEqual([
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_SCHEMA',
      'DB_SSL_MODE',
      'DB_USER',
      'DB_PASSWORD',
    ]);
    expect(error.message).toContain('DB_HOST, DB_PORT');
  });

  it('treats an empty value as missing', () => {
    expect(fail({ ...env, DB_USER: '' }).missing).toEqual(['DB_USER']);
  });

  it('reports missing and invalid names together', () => {
    const error = fail({ ...env, DB_HOST: undefined, DB_PORT: 'abc' });
    expect(error.missing).toEqual(['DB_HOST']);
    expect(error.invalid).toEqual(['DB_PORT']);
    expect(error.message).toBe(
      'database configuration is incomplete (missing: DB_HOST; invalid: DB_PORT)',
    );
  });

  it.each(['0', '65536', '-1', '5432.5', '54 32', '0x10', '5432abc', '100000'])(
    'rejects DB_PORT %s',
    (port) => {
      expect(fail({ ...env, DB_PORT: port }).invalid).toEqual(['DB_PORT']);
    },
  );

  it.each(['1', '5432', '65535'])('accepts DB_PORT %s', (port) => {
    expect(readDbConfig({ ...env, DB_PORT: port }).port).toBe(Number(port));
  });

  it.each(SSL_MODES)('accepts DB_SSL_MODE %s', (mode) => {
    expect(readDbConfig({ ...env, DB_SSL_MODE: mode }).sslMode).toBe(mode);
  });

  it.each(['Verify-Full', 'true', 'verify_full', 'on'])('rejects DB_SSL_MODE %s', (mode) => {
    expect(fail({ ...env, DB_SSL_MODE: mode }).invalid).toEqual(['DB_SSL_MODE']);
  });

  it.each(['my schema', 'a,b', '"quoted"', '1abc', 'a-b', 'a;b'])(
    'rejects DB_SCHEMA %s, which would not be one plain identifier',
    (schema) => {
      expect(fail({ ...env, DB_SCHEMA: schema }).invalid).toEqual(['DB_SCHEMA']);
    },
  );

  it.each(['has space', 'a/b', 'a@b', 'a?b'])('rejects DB_HOST %s', (host) => {
    expect(fail({ ...env, DB_HOST: host }).invalid).toEqual(['DB_HOST']);
  });

  it('never prints a value, not even the password', () => {
    const error = fail({ ...env, DB_PORT: 'not-a-port', DB_SSL_MODE: 'bad-mode' });
    expect(error.message).not.toContain('secret-value');
    expect(error.message).not.toContain('not-a-port');
    expect(error.message).not.toContain('bad-mode');
    const { message } = fail({ DB_PASSWORD: 'secret-value' });
    expect(message).not.toContain('secret-value');
  });
});

const config = (patch: Partial<DbConfig> = {}): DbConfig => ({
  ...readDbConfig(env),
  ...patch,
});

describe('buildConnectionUrl', () => {
  it('builds the URL with the ssl mode and the schema as search_path', () => {
    expect(buildConnectionUrl(config())).toBe(
      'postgres://someone:secret-value@127.0.0.1:5432/bf_test?sslmode=disable&options=-c%20search_path%3Dpublic',
    );
  });

  it('adds sslrootcert only when there is a CA file', () => {
    expect(buildConnectionUrl(config())).not.toContain('sslrootcert');
    const url = buildConnectionUrl(
      config({ sslMode: 'verify-full', sslCaFile: '/etc/bf/db-ca/ca.crt' }),
    );
    expect(url).toContain('sslmode=verify-full&sslrootcert=%2Fetc%2Fbf%2Fdb-ca%2Fca.crt&options=');
  });

  it.each(SSL_MODES)('puts sslmode=%s in the URL', (mode) => {
    expect(new URL(buildConnectionUrl(config({ sslMode: mode }))).searchParams.get('sslmode')).toBe(
      mode,
    );
  });

  it('keeps a password with @ / : # % ? and a space as one password', () => {
    const password = 'p@ss/w:rd#1%2?x y&z=1+2';
    const url = new URL(buildConnectionUrl(config({ password })));
    expect(decodeURIComponent(url.password)).toBe(password);
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.port).toBe('5432');
    expect(url.pathname).toBe('/bf_test');
    expect(url.hash).toBe('');
    expect([...url.searchParams.keys()]).toEqual(['sslmode', 'options']);
  });

  it('encodes the user and the database name too', () => {
    const url = new URL(buildConnectionUrl(config({ user: 'a@b:c', name: 'my db/x' })));
    expect(decodeURIComponent(url.username)).toBe('a@b:c');
    expect(decodeURIComponent(url.pathname.slice(1))).toBe('my db/x');
  });

  it('sets the schema through the options parameter, encoded, and reads back as -c search_path=<schema>', () => {
    const url = new URL(buildConnectionUrl(config({ schema: 'bf_app' })));
    expect(url.searchParams.get('options')).toBe('-c search_path=bf_app');
    expect(buildConnectionUrl(config({ schema: 'bf_app' }))).toContain(
      'options=-c%20search_path%3Dbf_app',
    );
  });

  it('puts an IPv6 host in brackets', () => {
    expect(new URL(buildConnectionUrl(config({ host: '::1' }))).hostname).toBe('[::1]');
  });

  it('builds a URL from what readDbConfig read, end to end', () => {
    const url = buildConnectionUrl(
      readDbConfig({
        ...env,
        DB_PASSWORD: 'a@b/c:d#e',
        DB_SSL_MODE: 'verify-full',
        DB_SSL_CA_FILE: '/etc/bf/db-ca/ca.crt',
      }),
    );
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.password)).toBe('a@b/c:d#e');
    expect(parsed.searchParams.get('sslrootcert')).toBe('/etc/bf/db-ca/ca.crt');
  });
});
