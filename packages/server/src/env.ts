import { z } from 'zod';

import { DEFAULT_NODE_ENV, NODE_ENVS } from '@bf/shared/constants';

const csv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

/** Accepts either base64(PEM) (single line, .env friendly) or raw PEM. */
const decodePem = (name: string, label: string) => (value: string, ctx: z.RefinementCtx) => {
  const pem = value.includes('-----BEGIN')
    ? value.replace(/\\n/g, '\n')
    : Buffer.from(value, 'base64').toString('utf8');
  if (!pem.includes(`-----BEGIN ${label}-----`) && !pem.includes('-----BEGIN RSA')) {
    ctx.addIssue({ code: 'custom', message: `${name} must be a base64-encoded PEM ${label}` });
    return z.NEVER;
  }
  return pem;
};

/** Env shared by every NestJS app. Apps do `baseEnvSchema.merge(postgresEnvSchema).extend({...})`. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default(DEFAULT_NODE_ENV),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  SERVICE_NAME: z.string().min(1).default('app'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: csv,
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(1000),
  /** base64(PEM) RS256 public key — every service verifies tokens locally with it. */
  JWT_PUBLIC_KEY: z.string().min(1).transform(decodePem('JWT_PUBLIC_KEY', 'PUBLIC KEY')),
  /** base64(PEM) RS256 private key — only the `auth` service signs tokens. */
  JWT_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((v, ctx) => (v ? decodePem('JWT_PRIVATE_KEY', 'PRIVATE KEY')(v, ctx) : undefined)),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('15m'),
  JWT_ISSUER: z.string().default('bf-auth'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/** Returns a `validate` function for ConfigModule.forRoot with readable error output. */
export function createEnvValidator<T extends z.ZodTypeAny>(schema: T) {
  return (config: Record<string, unknown>): z.infer<T> => {
    const result = schema.safeParse(config);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${issues}`);
    }
    return result.data as z.infer<T>;
  };
}
