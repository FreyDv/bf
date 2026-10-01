import { z } from 'zod';

import { baseEnvSchema } from '@bf/server';

const csv = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** `name=value,name=value` → Record. */
const pairs = (label: string) =>
  z.string().transform((v, ctx) => {
    const out: Record<string, string> = {};
    for (const entry of csv(v)) {
      const [k, ...rest] = entry.split('=');
      const val = rest.join('=');
      if (!k || !val) {
        ctx.addIssue({ code: 'custom', message: `${label}: expected name=value, got "${entry}"` });
        return z.NEVER;
      }
      out[k] = val;
    }
    return out;
  });

export const envSchema = baseEnvSchema.extend({
  SERVICE_NAME: z.string().default('api'),
  PORT: z.coerce.number().int().default(3000),
  /** Route table: `/<name>/*` → `<url>/*` (prefix stripped). */
  UPSTREAMS: pairs('UPSTREAMS').pipe(
    z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), z.string().url()),
  ),
  /**
   * Path prefixes (as seen by the browser, e.g. `/auth/api/auth/google`) that bypass JWT at the edge.
   * `/<svc>/health` is always public.
   */
  PUBLIC_PATHS: z.string().default('').transform(csv),
  /** `<name>=<role>`: requests to `/<name>/*` additionally require that role. */
  ROUTE_ROLES: pairs('ROUTE_ROLES').default(''),
  /** Per-identity rate limit at the edge (falls back to IP for anonymous requests). */
  EDGE_RATE_LIMIT: z.coerce.number().int().positive().default(600),
  EDGE_RATE_TTL_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;
