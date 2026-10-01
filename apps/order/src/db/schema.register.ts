/**
 * Aggregator consumed by drizzle-kit (drizzle.config.ts) and by DrizzleModule at runtime.
 * Bounded contexts re-export their tables here; @bf/events factories are instantiated once per app.
 * Tables live in the public schema of the service's own database (`order`).
 */
import { createInboxTable, createOutboxTable } from '@bf/events/tables';

export const outbox = createOutboxTable();
export const processedEvents = createInboxTable();
