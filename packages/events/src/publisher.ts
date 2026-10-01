import { eventEnvelopeSchema } from './envelope';

import type { EventEnvelope } from './envelope';
import type { OutboxTable } from './tables';
import type { DomainEvent } from '@bf/shared/ddd';

export const EVENT_PUBLISHER = Symbol.for('bf.EVENT_PUBLISHER');

/** Minimal executor shape (drizzle db or tx) so the package stays schema-agnostic. */
export interface OutboxExecutor {
  insert(table: OutboxTable): { values(rows: OutboxTable['$inferInsert'][]): Promise<unknown> };
}

/** Application-layer port: publish integration events inside the caller's transaction. */
export interface EventPublisher {
  publishAll(events: DomainEvent[], tx: OutboxExecutor): Promise<void>;
  publish(event: DomainEvent, tx: OutboxExecutor): Promise<void>;
}

export function toEnvelope(event: DomainEvent, source: string): EventEnvelope {
  return eventEnvelopeSchema.parse({
    id: event.id,
    type: event.type,
    version: event.version,
    occurredAt: event.occurredAt.toISOString(),
    source,
    aggregate: { type: event.aggregateType, id: event.aggregateId },
    correlationId: event.correlationId,
    causationId: event.causationId,
    payload: event.payload,
  }) as EventEnvelope;
}

/** Writes envelopes into the app's outbox table; Debezium relays them to Kafka. */
export class OutboxEventPublisher implements EventPublisher {
  constructor(
    private readonly outbox: OutboxTable,
    private readonly source: string,
  ) {}

  async publish(event: DomainEvent, tx: OutboxExecutor): Promise<void> {
    await this.publishAll([event], tx);
  }

  async publishAll(events: DomainEvent[], tx: OutboxExecutor): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((e) => {
      const envelope = toEnvelope(e, this.source);
      return {
        id: envelope.id,
        aggregateType: envelope.aggregate.type,
        aggregateId: envelope.aggregate.id,
        type: envelope.type,
        destination: envelope.type,
        payload: envelope,
      };
    });
    await tx.insert(this.outbox).values(rows);
  }
}
