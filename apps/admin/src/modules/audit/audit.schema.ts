import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Back-office audit trail (who did what in the admin UI). Placeholder for the MVP. */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
