import { RequestMethod } from '@nestjs/common';

import { HEADERS } from '../constants';
import { redactCensor, redactPaths } from './redaction.config';

import type { NodeEnv } from '../constants';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface LoggerConfigInput {
  nodeEnv: NodeEnv;
  level?: string;
  serviceName: string;
  /** Only requests whose URL starts with one of these prefixes are auto-logged. */
  logPathPrefixes?: string[];
}

export function createLoggerConfig(input: LoggerConfigInput): Params {
  const isProduction = input.nodeEnv === 'production';
  const level =
    input.level ??
    (input.nodeEnv === 'production' ? 'info' : input.nodeEnv === 'test' ? 'warn' : 'debug');
  const prefixes = input.logPathPrefixes ?? ['/api/'];

  return {
    pinoHttp: {
      level,
      base: { service: input.serviceName },
      autoLogging: { ignore: (req) => !prefixes.some((p) => (req.url ?? '').startsWith(p)) },
      redact: { paths: redactPaths, censor: redactCensor },
      serializers: {
        req: (req: IncomingMessage & { id?: string; query?: unknown; params?: unknown }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          remoteAddress: req.socket?.remoteAddress,
        }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        err: (error: Error) => ({
          type: error.constructor.name,
          message: error.message,
          stack: error.stack,
        }),
      },
      customProps: (req: IncomingMessage) => ({
        correlationId: req.headers[HEADERS.CORRELATION_ID],
        traceId: (req.headers[HEADERS.TRACEPARENT] as string | undefined)?.split('-')[1],
      }),
      customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, error) =>
        `${req.method} ${req.url} ${res.statusCode} - ${error.message}`,
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,service',
                messageFormat: '{context} | {msg}',
              },
            },
          }),
    },
    exclude: [
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'health/live' },
      { method: RequestMethod.GET, path: 'health/ready' },
    ],
  };
}
