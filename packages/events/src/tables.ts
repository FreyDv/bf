/**
 * `@bf/events/tables` — Drizzle table factories. Each DB-backed app instantiates them from
 * `src/db/schema.register.ts` (public schema of the service's own database):
 *   export const outbox = createOutboxTable()
 * Column names are explicit (snake_case) so they do not depend on drizzle `casing`.
 */
import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export function createOutboxTable(name = 'outbox') {
  return pgTable(
    name,
    {
      id: uuid('id').primaryKey(),
      aggregateType: text('aggregate_type').notNull(),
      aggregateId: text('aggregate_id').notNull(),
      type: text('type').notNull(),
      /** Debezium EventRouter `route.by.field` → topic. */
      destination: text('destination').notNull(),
      payload: jsonb('payload').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
        .notNull()
        .defaultNow(),
    },
    (t) => [index(`${name}_created_at_idx`).on(t.createdAt)],
  );
}

/** Idempotency table: (consumer_group, event_id) processed once. */
export function createInboxTable(name = 'processed_events') {
  return pgTable(
    name,
    {
      consumerGroup: text('consumer_group').notNull(),
      eventId: uuid('event_id').notNull(),
      eventType: text('event_type').notNull(),
      processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.consumerGroup, t.eventId] })],
  );
}

export type OutboxTable = ReturnType<typeof createOutboxTable>;
export type InboxTable = ReturnType<typeof createInboxTable>;
