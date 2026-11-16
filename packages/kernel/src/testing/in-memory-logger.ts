import type { LogFields, Logger } from '../logger.port.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields: LogFields;
}

/** The in-memory double of the Logger port (TST-5): records what was written so a use-case test can assert on it. */
export class InMemoryLogger implements Logger {
  readonly entries: LogEntry[] = [];

  debug(message: string, fields?: LogFields): void {
    this.record('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.record('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.record('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.record('error', message, fields);
  }

  private record(level: LogLevel, message: string, fields: LogFields = {}): void {
    this.entries.push({ level, message, fields });
  }
}
