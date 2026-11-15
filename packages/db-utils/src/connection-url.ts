import type { DbConfig } from './db-config.js';

const encode = encodeURIComponent;

// An IPv6 literal must be in brackets inside a URL.
const hostPart = (host: string): string =>
  host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

/**
 * Builds a postgres connection URL from validated settings (ADR-061). User, password and every query value are
 * percent-encoded (a space is `%20`, which libpq and pg-connection-string both read; `+` they do not), so a
 * password with `@`, `/`, `:` or `#` stays one password. The schema is set as the session search path through the
 * `options` parameter, and the CA file, when there is one, as `sslrootcert`.
 */
export function buildConnectionUrl(config: DbConfig): string {
  const query = [`sslmode=${encode(config.sslMode)}`];
  if (config.sslCaFile !== undefined) query.push(`sslrootcert=${encode(config.sslCaFile)}`);
  query.push(`options=${encode(`-c search_path=${config.schema}`)}`);
  const auth = `${encode(config.user)}:${encode(config.password)}`;
  return `postgres://${auth}@${hostPart(config.host)}:${config.port}/${encode(config.name)}?${query.join('&')}`;
}
