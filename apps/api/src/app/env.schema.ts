import { z } from 'zod';

import { baseEnvSchema } from '@bf/server';

import { parseGraph } from '../orchestrator/service-graph';

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

export const envSchema = baseEnvSchema
  .extend({
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

    // ---- scale-to-zero orchestrator (src/orchestrator). `none` locally; `ecs` on Fargate, rendered by infra/aws.
    ORCHESTRATOR: z.enum(['none', 'ecs']).default('none'),
    /** ECS cluster name (required with ORCHESTRATOR=ecs). */
    ECS_CLUSTER: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    /** ECS service name = prefix + upstream name (`bf-prod-` → `bf-prod-order`). */
    ECS_SERVICE_PREFIX: z.string().default(''),
    /** `admin=auth|order,billing=order`: waking a service wakes what it calls; dependents keep it awake. */
    SERVICE_GRAPH: z
      .string()
      .default('')
      .transform((v, ctx) => {
        try {
          return parseGraph(v);
        } catch (error) {
          ctx.addIssue({ code: 'custom', message: (error as Error).message });
          return z.NEVER;
        }
      }),
    /** Services that never sleep (comma list). */
    ALWAYS_ON: z.string().default('').transform(csv),
    /** Idle seconds before a service is put to sleep (tag bf:cooldown on the ECS service overrides it). */
    DEFAULT_COOLDOWN_S: z.coerce.number().int().positive().default(10_800),
    /** `<name>=<seconds>` per-service cooldown overrides. */
    SERVICE_COOLDOWNS: pairs('SERVICE_COOLDOWNS').default(''),
    /** `<name>=<n>` maximum tasks while awake (default 4). */
    SERVICE_MAX_TASKS: pairs('SERVICE_MAX_TASKS').default(''),
    /** How long a request is held while a service starts; then 503 + Retry-After. */
    WAKE_TIMEOUT_MS: z.coerce.number().int().positive().default(50_000),
    /** desiredCount 1 without a running task for this long → back to sleep + `wake_failed`. */
    WAKE_FAIL_AFTER_MS: z.coerce.number().int().positive().default(180_000),
  })
  .superRefine((env, ctx) => {
    if (env.ORCHESTRATOR === 'ecs' && !env.ECS_CLUSTER)
      ctx.addIssue({
        code: 'custom',
        path: ['ECS_CLUSTER'],
        message: 'ECS_CLUSTER is required when ORCHESTRATOR=ecs',
      });
  });

export type Env = z.infer<typeof envSchema>;
