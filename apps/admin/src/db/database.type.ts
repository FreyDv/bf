import type * as schema from './schema.register';
import type { DrizzleDatabase, DrizzleExecutor } from '@bf/db';

export type AdminSchema = typeof schema;
export type AdminDatabase = DrizzleDatabase<AdminSchema>;
export type AdminExecutor = DrizzleExecutor<AdminSchema>;
