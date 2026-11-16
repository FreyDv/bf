// The pino levels. The production value is OBS-2's (ADR-043 item 8); this only reads it.
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

// An invalid value throws at startup: a typo must not leave a service silently logging at the wrong level (ERR-3).
export function readLogLevel(env: Readonly<Record<string, string | undefined>>): LogLevel {
  const raw = env['LOG_LEVEL'];
  if (raw === undefined || raw === '') return DEFAULT_LOG_LEVEL;
  const level = LOG_LEVELS.find((candidate) => candidate === raw);
  if (level === undefined) {
    throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${raw}"`);
  }
  return level;
}
