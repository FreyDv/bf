import type * as schema from './schema.register';
import type { DrizzleDatabase, DrizzleExecutor } from '@bf/db';

export type BillingSchema = typeof schema;
export type BillingDatabase = DrizzleDatabase<BillingSchema>;
export type BillingExecutor = DrizzleExecutor<BillingSchema>;
