// Names whose value never reaches the log (ADR-032 item 4, ADR-043 item 7.3, ERR-6). LOG-1 adds the signed-link
// parameters of Spaces as one more entry.
export const REDACTED_FIELDS = [
  'phone',
  'address',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
] as const;

export const REDACT_CENSOR = '[redacted]';

// pino paths: the name at the top level and one level deep. Deeper nesting is not covered; a caller that logs a
// deeper object chooses its fields.
export const REDACT_PATHS: string[] = REDACTED_FIELDS.flatMap((name) => [name, `*.${name}`]);
