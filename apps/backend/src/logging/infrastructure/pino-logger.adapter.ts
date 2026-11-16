import { pino } from 'pino';
import type { DestinationStream, Logger as PinoLogger } from 'pino';
import type { LogFields, Logger, RequestContext } from '@bf/kernel';
import type { LogLevel } from './log-level.js';
import { REDACT_CENSOR, REDACT_PATHS } from './log-redaction.js';

// The fields of a record, in one place (R4: the list lives in code, ADR-043 item 7). `code` and `err` appear when the
// caller gives them; the caller's other fields follow.
export const LOG_RECORD_FIELDS = [
  'time',
  'level',
  'msg',
  'correlationId',
  'actorId',
  'actorSource',
  'code',
  'err',
] as const;

// What the request auto-logging adds on top (pino-http).
export const HTTP_LOG_FIELDS = ['req', 'res', 'responseTime'] as const;

// The adapter owns these: the caller never passes them (the type forbids it; this is the runtime half).
const CONTEXT_FIELDS = ['correlationId', 'actorId', 'actorSource'] as const;

export interface PinoOptions {
  readonly level: LogLevel;
  readonly context: RequestContext;
}

/** Synchronous stdout: a record written just before a crash is not lost in a buffer. */
export function stdoutDestination(): DestinationStream {
  return pino.destination({ fd: 1, sync: true });
}

/** The one pino instance of the process: JSON to the destination, the context on every record, redaction. */
export function createPino(options: PinoOptions, destination: DestinationStream): PinoLogger {
  const { level, context } = options;
  return pino(
    {
      level,
      // No pid and no hostname: the collector knows the pod (ADR-043 item 7).
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      mixin: () => ({
        correlationId: context.correlationId,
        actorId: context.actorId,
        actorSource: context.actorSource,
      }),
      redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
    },
    destination,
  );
}

/** The Logger port over pino (ADR-032 item 2). */
export class PinoLoggerAdapter implements Logger {
  constructor(private readonly logger: PinoLogger) {}

  debug(message: string, fields?: LogFields): void {
    this.logger.debug(withoutContextFields(fields), message);
  }

  info(message: string, fields?: LogFields): void {
    this.logger.info(withoutContextFields(fields), message);
  }

  warn(message: string, fields?: LogFields): void {
    this.logger.warn(withoutContextFields(fields), message);
  }

  error(message: string, fields?: LogFields): void {
    this.logger.error(withoutContextFields(fields), message);
  }
}

function withoutContextFields(fields: LogFields | undefined): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...fields };
  for (const name of CONTEXT_FIELDS) delete safe[name];
  return safe;
}
