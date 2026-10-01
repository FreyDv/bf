import { z } from 'zod';

import { postgresEnvSchema } from '@bf/db';
import { baseEnvSchema } from '@bf/server';

export const envSchema = baseEnvSchema.merge(postgresEnvSchema).extend({
  SERVICE_NAME: z.string().default('course'),
  PORT: z.coerce.number().int().default(3003),
});

export type Env = z.infer<typeof envSchema>;
