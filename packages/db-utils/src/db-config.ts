export const SSL_MODES = [
  'disable',
  'allow',
  'prefer',
  'require',
  'verify-ca',
  'verify-full',
] as const;

export type SslMode = (typeof SSL_MODES)[number];

export interface DbConfig {
  host: string;
  port: number;
  name: string;
  schema: string;
  sslMode: SslMode;
  user: string;
  password: string;
  /** Path of the CA certificate file; set only when the server certificate is checked against it. */
  sslCaFile?: string;
}

/** Names of the variables that are missing or invalid; never their values (they may be secrets). */
export class DbConfigError extends Error {
  readonly missing: readonly string[];
  readonly invalid: readonly string[];

  constructor(missing: readonly string[], invalid: readonly string[]) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
    if (invalid.length > 0) parts.push(`invalid: ${invalid.join(', ')}`);
    super(`database configuration is incomplete (${parts.join('; ')})`);
    this.name = 'DbConfigError';
    this.missing = missing;
    this.invalid = invalid;
  }
}

export type Env = Readonly<Record<string, string | undefined>>;

// The schema goes into `-c search_path=<schema>`: a plain identifier keeps a space, a comma or a quote from
// turning that option into a second setting or a different search path.
const SCHEMA = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PORT = /^\d{1,5}$/;
const HOST = /^[^\s/?#@]+$/;

const isSslMode = (value: string): value is SslMode =>
  (SSL_MODES as readonly string[]).includes(value);

/**
 * Reads the connection settings from environment variables (ADR-061). Reports every missing or invalid name
 * in one error so a broken deployment is fixed in one round, and never prints a value.
 */
export function readDbConfig(env: Env): DbConfig {
  const missing: string[] = [];
  const invalid: string[] = [];
  const read = (name: string): string | undefined => {
    const value = env[name];
    if (value === undefined || value === '') {
      missing.push(name);
      return undefined;
    }
    return value;
  };

  const host = read('DB_HOST');
  const portText = read('DB_PORT');
  const name = read('DB_NAME');
  const schema = read('DB_SCHEMA');
  const sslText = read('DB_SSL_MODE');
  const user = read('DB_USER');
  const password = read('DB_PASSWORD');
  const caFile = env['DB_SSL_CA_FILE'] === '' ? undefined : env['DB_SSL_CA_FILE'];

  if (host !== undefined && !HOST.test(host)) invalid.push('DB_HOST');
  let port = 0;
  if (portText !== undefined) {
    port = PORT.test(portText) ? Number(portText) : 0;
    if (port < 1 || port > 65535) invalid.push('DB_PORT');
  }
  if (schema !== undefined && !SCHEMA.test(schema)) invalid.push('DB_SCHEMA');
  if (sslText !== undefined && !isSslMode(sslText)) invalid.push('DB_SSL_MODE');

  if (missing.length > 0 || invalid.length > 0) throw new DbConfigError(missing, invalid);

  return {
    host: host!,
    port,
    name: name!,
    schema: schema!,
    sslMode: sslText as SslMode,
    user: user!,
    password: password!,
    ...(caFile === undefined ? {} : { sslCaFile: caFile }),
  };
}
