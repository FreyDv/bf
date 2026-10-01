import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('bf'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:4000'),
  /** The edge (`apps/api`): every backend call goes through it as /<service>/… */
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
});

// NEXT_PUBLIC_* vars are inlined at build time, so they must be referenced explicitly.
const parsed = schema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid NEXT_PUBLIC_* environment: ${parsed.error.message}`);
}

export const env = parsed.data;
export type Env = typeof env;
