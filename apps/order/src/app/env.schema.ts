import { z } from 'zod';

import { postgresEnvSchema } from '@bf/db';
import { baseEnvSchema } from '@bf/server';
import { storageEnvSchema } from '@bf/storage';

/** order env = base + postgres + storage + upstream auth. */
export const envSchema = baseEnvSchema
  .merge(postgresEnvSchema)
  .merge(storageEnvSchema)
  .extend({
    SERVICE_NAME: z.string().default('order'),
    PORT: z.coerce.number().int().default(3002),
    AUTH_URL: z.string().url(),
  });

export type Env = z.infer<typeof envSchema>;
