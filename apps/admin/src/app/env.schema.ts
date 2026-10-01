import { z } from 'zod';

import { postgresEnvSchema } from '@bf/db';
import { baseEnvSchema } from '@bf/server';

export const envSchema = baseEnvSchema.merge(postgresEnvSchema).extend({
  SERVICE_NAME: z.string().default('admin'),
  PORT: z.coerce.number().int().default(3005),
  AUTH_URL: z.string().url(),
  ORDER_URL: z.string().url(),
  COURSE_URL: z.string().url(),
  BILLING_URL: z.string().url(),
  AI_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
