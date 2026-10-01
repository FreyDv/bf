/**
 * Domain event raised by an aggregate. Framework-free.
 * `type` follows `<context>.<aggregate>.<event>` (e.g. `orders.order.created`)
 * and doubles as the Kafka topic name via the outbox `destination` column.
 */
export interface DomainEvent<P = unknown> {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: P;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export type DomainEventInit<P> = Omit<DomainEvent<P>, 'id' | 'occurredAt' | 'version'> &
  Partial<Pick<DomainEvent<P>, 'id' | 'occurredAt' | 'version'>>;

/** Pattern for event type strings; enforced again by the zod envelope in @bf/events. */
export const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){2,}$/;

let idFactory: () => string = () => {
  // Lazily use the Node crypto API without importing it at module level (keeps the domain layer portable).
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  throw new Error('No UUID generator available; call setEventIdFactory()');
};

export function setEventIdFactory(factory: () => string): void {
  idFactory = factory;
}

export function createDomainEvent<P>(init: DomainEventInit<P>): DomainEvent<P> {
  if (!EVENT_TYPE_PATTERN.test(init.type)) {
    throw new Error(`Invalid event type "${init.type}" (expected <context>.<aggregate>.<event>)`);
  }
  return {
    id: init.id ?? idFactory(),
    version: init.version ?? 1,
    occurredAt: init.occurredAt ?? new Date(),
    ...init,
  };
}
