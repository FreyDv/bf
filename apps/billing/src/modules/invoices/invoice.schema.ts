import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { INVOICE_STATUSES } from '@bf/contracts/billing';

export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    customerId: text('customer_id').notNull(),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('invoices_order_id_idx').on(t.orderId)],
);
