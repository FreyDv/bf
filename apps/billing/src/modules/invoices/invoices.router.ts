import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Input, Query, Router, UseMiddlewares } from 'nestjs-trpc';

import {
  invoicesGetByOrderInputSchema,
  invoicesGetByOrderOutputSchema,
} from '@bf/contracts/billing';
import { DRIZZLE } from '@bf/db';
import { AuthedMiddleware } from '@bf/trpc';

import { invoices } from './invoice.schema';

import type { BillingDatabase } from '../../db/database.type';
import type { z } from 'zod';

@Router({ alias: 'invoices' })
@UseMiddlewares(AuthedMiddleware)
export class InvoicesRouter {
  constructor(@Inject(DRIZZLE) private readonly db: BillingDatabase) {}

  @Query({ input: invoicesGetByOrderInputSchema, output: invoicesGetByOrderOutputSchema })
  async getByOrder(@Input() input: z.infer<typeof invoicesGetByOrderInputSchema>) {
    const [row] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, input.orderId))
      .limit(1);
    return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  }
}
