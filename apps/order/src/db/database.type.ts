import type * as schema from './schema.register';
import type { DrizzleDatabase, DrizzleExecutor } from '@bf/db';

export type OrderSchema = typeof schema;
export type OrderDatabase = DrizzleDatabase<OrderSchema>;
export type OrderExecutor = DrizzleExecutor<OrderSchema>;
