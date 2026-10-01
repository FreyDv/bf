import { randomUUID } from 'node:crypto';

import { CLS_KEYS, HEADERS } from '../constants';

import type { Request } from 'express';
import type { ClsModuleOptions, ClsService } from 'nestjs-cls';

/** Parses W3C traceparent: version-traceId-parentId-flags */
export function parseTraceparent(
  value?: string,
): { traceId: string; parentId: string; flags: string } | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  if (parts.length < 4 || parts[1]?.length !== 32) return undefined;
  return { traceId: parts[1], parentId: parts[2] ?? '', flags: parts[3] ?? '' };
}

/** nestjs-cls configuration: request id, correlation id and trace context in CLS. */
export function createClsConfig(): ClsModuleOptions {
  return {
    global: true,
    middleware: {
      mount: true,
      generateId: true,
      idGenerator: (req: Request) =>
        (req.headers[HEADERS.REQUEST_ID] as string | undefined) || randomUUID(),
      setup: (cls: ClsService, req: Request) => {
        cls.set(
          CLS_KEYS.CORRELATION_ID,
          (req.headers[HEADERS.CORRELATION_ID] as string | undefined) || randomUUID(),
        );
        const trace = parseTraceparent(req.headers[HEADERS.TRACEPARENT] as string | undefined);
        if (trace) cls.set(CLS_KEYS.TRACE_ID, trace.traceId);
      },
    },
  };
}
