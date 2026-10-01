import { z } from 'zod';

import { postgresEnvSchema } from '@bf/db';
import { baseEnvSchema } from '@bf/server';

export const envSchema = baseEnvSchema.merge(postgresEnvSchema).extend({
  SERVICE_NAME: z.string().default('billing'),
  PORT: z.coerce.number().int().default(3004),
  ORDER_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
