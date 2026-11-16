/** `MODULE.REASON`, the stable machine-readable form of an error code (ERR-1). */
export type ErrorCode = `${string}.${string}`;

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Fields of one log record: plain JSON values plus the two the adapter treats specially. The request context fields
 * are not the caller's to set (`never`): the adapter adds them from the request context (ADR-070).
 */
export interface LogFields {
  readonly code?: ErrorCode;
  /** An error to log; the adapter serialises it, so nothing here shapes the stack or the cause chain. */
  readonly err?: Error;
  readonly correlationId?: never;
  readonly actorId?: never;
  readonly actorSource?: never;
  readonly [field: string]: JsonValue | Error | undefined;
}

/** What code writes through (ADR-032 item 2). The pino adapter lives in the backend's infrastructure. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}
