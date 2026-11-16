import { describe, expect, it } from 'vitest';
import type { LogFields, Logger } from '@bf/kernel';
import {
  createPino,
  HTTP_LOG_FIELDS,
  LOG_RECORD_FIELDS,
  PinoLoggerAdapter,
} from './pino-logger.adapter.js';
import { REDACT_CENSOR, REDACTED_FIELDS } from './log-redaction.js';
import { AsyncLocalRequestContext } from './request-context.adapter.js';

type Record_ = Record<string, unknown>;

function setup() {
  const lines: string[] = [];
  const context = new AsyncLocalRequestContext();
  const pino = createPino(
    { level: 'debug', context },
    {
      write: (line: string) => {
        lines.push(line);
      },
    },
  );
  const logger: Logger = new PinoLoggerAdapter(pino);
  const records = (): Record_[] => lines.map((line) => JSON.parse(line) as Record_);
  const inRequest = <T>(
    fn: () => T,
    actorId: string | null = null,
    actorSource: string | null = null,
  ) => context.run({ correlationId: 'c-1', actorId, actorSource }, fn);
  return { logger, records, inRequest };
}

describe('PinoLoggerAdapter', () => {
  it('puts the correlation id of the request on every record, at every level', () => {
    const { logger, records, inRequest } = setup();

    inRequest(() => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
    });

    expect(records().map((r) => [r['level'], r['msg'], r['correlationId']])).toEqual([
      ['debug', 'd', 'c-1'],
      ['info', 'i', 'c-1'],
      ['warn', 'w', 'c-1'],
      ['error', 'e', 'c-1'],
    ]);
  });

  it('keeps the correlation id through async work started inside the request', async () => {
    const { logger, records, inRequest } = setup();

    await inRequest(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      logger.info('after await');
    });

    expect(records()[0]?.['correlationId']).toBe('c-1');
  });

  it('carries the actor of the request, and null before authentication binds one', () => {
    const { logger, records, inRequest } = setup();

    inRequest(() => logger.info('anonymous'));
    inRequest(() => logger.info('known'), 'u-7', 'web');

    expect(records().map((r) => [r['actorId'], r['actorSource']])).toEqual([
      [null, null],
      ['u-7', 'web'],
    ]);
  });

  it('writes a record outside any request with a null correlation id', () => {
    const { logger, records } = setup();

    logger.info('starting');

    expect(records()[0]).toMatchObject({ correlationId: null, actorId: null, actorSource: null });
  });

  it('does not let a caller overwrite the context fields', () => {
    const { logger, records, inRequest } = setup();
    const forged = { correlationId: 'forged', actorId: 'forged' } as unknown as LogFields;

    inRequest(() => logger.info('x', forged));

    expect(records()[0]).toMatchObject({ correlationId: 'c-1', actorId: null });
  });

  it('writes the code, the caller fields and the error in the JSON body', () => {
    const { logger, records, inRequest } = setup();

    inRequest(() =>
      logger.error('order failed', {
        code: 'ORDERS.NOT_FOUND',
        orderId: 'o-1',
        items: [1, 2],
        err: new TypeError('boom'),
      }),
    );

    const record = records()[0];
    expect(record).toMatchObject({
      level: 'error',
      msg: 'order failed',
      code: 'ORDERS.NOT_FOUND',
      orderId: 'o-1',
      items: [1, 2],
    });
    expect(record?.['err']).toMatchObject({ type: 'TypeError', message: 'boom' });
    expect(typeof record?.['time']).toBe('string');
  });

  it('writes only the listed fields and the fields the caller gave', () => {
    const { logger, records, inRequest } = setup();

    inRequest(() => logger.info('plain'));
    inRequest(() => logger.warn('with code', { code: 'A.B', extra: 1 }));

    const allowed = new Set<string>([...LOG_RECORD_FIELDS, ...HTTP_LOG_FIELDS]);
    const [plain, withCode] = records();
    expect(Object.keys(plain ?? {}).filter((key) => !allowed.has(key))).toEqual([]);
    expect(Object.keys(withCode ?? {}).filter((key) => !allowed.has(key))).toEqual(['extra']);
  });

  it('omits code and err when the caller gives none', () => {
    const { logger, records } = setup();

    logger.info('plain');

    expect(Object.keys(records()[0] ?? {})).not.toContain('code');
    expect(Object.keys(records()[0] ?? {})).not.toContain('err');
  });

  describe.each(REDACTED_FIELDS)('the field %s', (name) => {
    it('is hidden at the top level', () => {
      const { logger, records } = setup();

      logger.info('x', { [name]: 'SENSITIVE' });

      expect(records()[0]?.[name]).toBe(REDACT_CENSOR);
      expect(JSON.stringify(records())).not.toContain('SENSITIVE');
    });

    it('is hidden one level deep', () => {
      const { logger, records } = setup();

      logger.info('x', { customer: { [name]: 'SENSITIVE', name: 'visible' } });

      expect(records()[0]?.['customer']).toEqual({ [name]: REDACT_CENSOR, name: 'visible' });
      expect(JSON.stringify(records())).not.toContain('SENSITIVE');
    });
  });
});
