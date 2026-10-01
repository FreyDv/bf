import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common';

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'void'] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  customerId: z.string(),
  status: invoiceStatusSchema,
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: isoDateTimeSchema,
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoicesGetByOrderInputSchema = z.object({ orderId: idSchema });
export const invoicesGetByOrderOutputSchema = invoiceSchema.nullable();
