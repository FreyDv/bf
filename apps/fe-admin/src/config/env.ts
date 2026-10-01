import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('bf admin'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:4001'),
  /** The edge (`apps/api`): every backend call goes through it as /<service>/… */
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_DEV_TOKEN_SUB: z.string().min(1).default('admin'),
});

// NEXT_PUBLIC_* vars are inlined at build time, so they must be referenced explicitly
// (destructuring `process.env` would leave them undefined in the browser bundle).
const parsed = schema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_DEV_TOKEN_SUB: process.env.NEXT_PUBLIC_DEV_TOKEN_SUB,
});

if (!parsed.success) {
  throw new Error(`Invalid NEXT_PUBLIC_* environment: ${parsed.error.message}`);
}

export const env = parsed.data;
export type Env = typeof env;
