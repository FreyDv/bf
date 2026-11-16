import { describe, expect, it } from 'vitest';
import { InMemoryLogger } from './index.js';

describe('InMemoryLogger', () => {
  it('records the level, the message and the fields of each call in order', () => {
    const logger = new InMemoryLogger();
    const cause = new Error('boom');

    logger.info('started');
    logger.error('failed', { code: 'ORDERS.NOT_FOUND', err: cause, orderId: 'o-1' });

    expect(logger.entries).toEqual([
      { level: 'info', message: 'started', fields: {} },
      {
        level: 'error',
        message: 'failed',
        fields: { code: 'ORDERS.NOT_FOUND', err: cause, orderId: 'o-1' },
      },
    ]);
  });
});
