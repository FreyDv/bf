import { z } from 'zod';

import { postgresEnvSchema } from '@bf/db';
import { baseEnvSchema } from '@bf/server';

/** auth env = base (+ JWT_PRIVATE_KEY required) + postgres. */
export const envSchema = baseEnvSchema
  .merge(postgresEnvSchema)
  .extend({
    SERVICE_NAME: z.string().default('auth'),
    PORT: z.coerce.number().int().default(3001),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  })
  .refine((e) => Boolean(e.JWT_PRIVATE_KEY), {
    message: 'auth needs JWT_PRIVATE_KEY to sign tokens',
    path: ['JWT_PRIVATE_KEY'],
  });

export type Env = z.infer<typeof envSchema>;
