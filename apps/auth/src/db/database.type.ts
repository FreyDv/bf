import type * as schema from './schema.register';
import type { DrizzleDatabase, DrizzleExecutor } from '@bf/db';

export type AuthSchema = typeof schema;
export type AuthDatabase = DrizzleDatabase<AuthSchema>;
export type AuthExecutor = DrizzleExecutor<AuthSchema>;
