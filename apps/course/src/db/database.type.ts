import type * as schema from './schema.register';
import type { DrizzleDatabase, DrizzleExecutor } from '@bf/db';

export type CourseSchema = typeof schema;
export type CourseDatabase = DrizzleDatabase<CourseSchema>;
export type CourseExecutor = DrizzleExecutor<CourseSchema>;
