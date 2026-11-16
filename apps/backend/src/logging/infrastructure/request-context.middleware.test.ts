import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { AsyncLocalRequestContext } from './request-context.adapter.js';
import {
  CORRELATION_ID_HEADER,
  requestContextMiddleware,
  resolveCorrelationId,
} from './request-context.middleware.js';

const V4 = '3f2b8c1e-9d4a-4e6b-8a1c-0b7d5e2f9a34';
const V7 = '0192f3a4-5b6c-7d8e-9f01-23456789abcd';
const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
  it('accepts an incoming UUID of any version', () => {
    expect(resolveCorrelationId(V4)).toBe(V4);
    expect(resolveCorrelationId(V7)).toBe(V7);
  });

  it.each([
    ['absent', undefined],
    ['not a UUID', 'abc'],
    ['longer than 36 characters', `${V4}0`],
    ['a UUID with text around it', `x${V4}`],
    ['a log-injection attempt', `${V4}\n{"level":"fatal"}`],
    ['repeated headers', [V4, V7]],
  ])('generates a fresh UUID when the header is %s', (_name, header) => {
    expect(resolveCorrelationId(header)).toMatch(GENERATED);
  });
});

describe('requestContextMiddleware', () => {
  function run(headerValue?: string) {
    const context = new AsyncLocalRequestContext();
    const headers: Record<string, string> = {};
    const req = {
      headers: headerValue === undefined ? {} : { [CORRELATION_ID_HEADER]: headerValue },
    } as unknown as IncomingMessage;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as unknown as ServerResponse;
    let seen: string | null = null;
    requestContextMiddleware(context)(req, res, () => {
      seen = context.correlationId;
    });
    return { headers, seen, context };
  }

  it('opens the context for the rest of the chain and echoes the id', () => {
    const { headers, seen, context } = run(V4);

    expect(seen).toBe(V4);
    expect(headers[CORRELATION_ID_HEADER]).toBe(V4);
    expect(context.correlationId).toBeNull();
  });

  it('starts a request with no actor', () => {
    const context = new AsyncLocalRequestContext();
    const req = { headers: {} } as unknown as IncomingMessage;
    const res = { setHeader: () => undefined } as unknown as ServerResponse;
    requestContextMiddleware(context)(req, res, () => {
      expect(context.actorId).toBeNull();
      expect(context.actorSource).toBeNull();
    });
  });

  it('replaces an invalid incoming id with a generated one and echoes that', () => {
    const { headers, seen } = run('not-a-uuid');

    expect(seen).toMatch(GENERATED);
    expect(headers[CORRELATION_ID_HEADER]).toBe(seen);
  });
});
