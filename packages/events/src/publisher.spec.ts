import { createDomainEvent } from '@bf/shared/ddd';

import { parseEnvelope } from './envelope';
import { OutboxEventPublisher, toEnvelope } from './publisher';
import { createOutboxTable } from './tables';

describe('OutboxEventPublisher', () => {
  const outbox = createOutboxTable('outbox_test');

  it('writes one outbox row per event with destination = type', async () => {
    const rows: unknown[] = [];
    const tx = { insert: () => ({ values: async (r: unknown[]) => void rows.push(...r) }) };
    const publisher = new OutboxEventPublisher(outbox, 'api');
    const event = createDomainEvent({
      type: 'orders.order.created',
      aggregateType: 'Order',
      aggregateId: 'o1',
      payload: { total: 5 },
    });
    await publisher.publishAll([event], tx);
    expect(rows).toHaveLength(1);
    const row = rows[0] as { destination: string; payload: unknown };
    expect(row.destination).toBe('orders.order.created');
    expect(parseEnvelope(row.payload).aggregate.id).toBe('o1');
  });

  it('envelope round-trips through zod', () => {
    const e = createDomainEvent({
      type: 'a.b.c',
      aggregateType: 'A',
      aggregateId: '1',
      payload: { x: 1 },
    });
    expect(parseEnvelope(JSON.parse(JSON.stringify(toEnvelope(e, 'api')))).id).toBe(e.id);
  });
});
