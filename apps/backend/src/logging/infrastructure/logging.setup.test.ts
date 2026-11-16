import 'reflect-metadata';
import { Inject } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Logger } from '@bf/kernel';
import { Query, Router } from 'nestjs-trpc';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { configureApp } from '../../configure-app.js';
import { LOGGER } from '../public/logging.tokens.js';
import { LOG_DESTINATION } from './pino.tokens.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLIENT_ID = '3f2b8c1e-9d4a-4e6b-8a1c-0b7d5e2f9a34';
const OTHER_ID = '7a1d9e40-2b53-4c8f-9e61-5d3a8b0c4f12';
const QUERY_ID = '0a9c4d6e-1f27-4b83-a5d0-6e8f3c1b2a47';
const SECRET_INPUT = 'secret-input-value-1234';

// A throwaway tRPC procedure that logs through the port, to see a record written during a tRPC call.
@Router({ alias: 'probe' })
class ProbeRouter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  @Query({
    input: z.object({ phone: z.string() }).optional(),
    output: z.object({ ok: z.boolean() }),
  })
  ping(): { ok: boolean } {
    this.logger.info('probe called', { code: 'PROBE.CALLED' });
    return { ok: true };
  }
}

describe('configureApp logging', () => {
  let app: INestApplication;
  let origin: string;
  const lines: string[] = [];
  // The access record is written when the response finishes, which can be after the client has read it.
  const completedRecord = (correlationId: string) =>
    vi.waitFor(() => {
      const found = records().find(
        (r) => r['msg'] === 'request completed' && r['correlationId'] === correlationId,
      );
      expect(found).toBeDefined();
      return found;
    });
  const records = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [ProbeRouter],
    })
      .overrideProvider(LOG_DESTINATION)
      .useValue({ write: (line: string) => lines.push(line) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  afterEach(() => {
    lines.length = 0;
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('runs a tRPC call inside the request context: a record logged there carries the incoming id', async () => {
    const response = await fetch(`${origin}/api/trpc/probe.ping`, {
      headers: { 'x-request-id': CLIENT_ID },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(CLIENT_ID);
    const probe = records().find((r) => r['msg'] === 'probe called');
    expect(probe).toMatchObject({ correlationId: CLIENT_ID, code: 'PROBE.CALLED', level: 'info' });
  });

  it('generates an id when none or an invalid one comes in, and echoes it', async () => {
    const response = await fetch(`${origin}/api/trpc/probe.ping`, {
      headers: { 'x-request-id': 'not-a-uuid' },
    });

    const id = response.headers.get('x-request-id');
    expect(id).toMatch(UUID);
    expect(id).not.toBe('not-a-uuid');
    expect(records().find((r) => r['msg'] === 'probe called')?.['correlationId']).toBe(id);
  });

  it('logs the request with the same id and only the whitelisted fields', async () => {
    await fetch(`${origin}/api/trpc/probe.ping`, {
      headers: {
        'x-request-id': OTHER_ID,
        cookie: 'session=SESSION_VALUE',
        authorization: 'Bearer T',
      },
    });

    const completed = await completedRecord(OTHER_ID);
    expect(completed).toMatchObject({
      correlationId: OTHER_ID,
      req: { method: 'GET', path: '/api/trpc/probe.ping' },
      res: { statusCode: 200 },
    });
    expect(Object.keys(completed?.['req'] as object)).toEqual(['method', 'path']);
    expect(Object.keys(completed?.['res'] as object)).toEqual(['statusCode']);
    expect(typeof completed?.['responseTime']).toBe('number');
    expect(lines.join('')).not.toMatch(/SESSION_VALUE|Bearer T|127\.0\.0\.1/);
  });

  it('keeps the query string, where tRPC carries the input, out of every record', async () => {
    const input = encodeURIComponent(JSON.stringify({ phone: SECRET_INPUT }));
    await fetch(`${origin}/api/trpc/probe.ping?input=${input}`, {
      headers: { 'x-request-id': QUERY_ID },
    });

    const completed = await completedRecord(QUERY_ID);
    expect(completed?.['req']).toEqual({ method: 'GET', path: '/api/trpc/probe.ping' });
    expect(lines.join('')).not.toContain(SECRET_INPUT);
    expect(lines.join('')).not.toContain('input=');
  });
});

describe('LOG_LEVEL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stops the application from starting when it is not a pino level', async () => {
    vi.stubEnv('LOG_LEVEL', 'loud');

    await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(
      /LOG_LEVEL must be one of/,
    );
  });
});
