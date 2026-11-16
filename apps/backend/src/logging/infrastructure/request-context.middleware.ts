import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AsyncLocalRequestContext } from './request-context.adapter.js';

export const CORRELATION_ID_HEADER = 'x-request-id';

// Any UUID version, 36 characters: a value that is not one never reaches the log, so a client cannot inject text.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveCorrelationId(header: string | string[] | undefined): string {
  return typeof header === 'string' && UUID.test(header) ? header : randomUUID();
}

/**
 * Opens the request context and echoes the id. Plain Node types, not Express's: it is registered with `app.use` before
 * everything Nest and tRPC mount, so the context is open for all of them (ADR-070).
 */
export function requestContextMiddleware(context: AsyncLocalRequestContext) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const correlationId = resolveCorrelationId(req.headers[CORRELATION_ID_HEADER]);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    context.run({ correlationId, actorId: null, actorSource: null }, next);
  };
}
