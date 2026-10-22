import { z } from 'zod';

import { isoDateTimeSchema } from '../common';

/**
 * The edge's own procedures (`/_services/trpc`, role `admin`): the scale-to-zero orchestrator's view of the
 * ECS services behind it, the runtime knobs, and the Aurora clusters of the account.
 */

/** Upstream name as in UPSTREAMS (`order`), never a path. */
export const serviceNameSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const serviceNameInputSchema = z.object({ name: serviceNameSchema });

export const serviceStatusSchema = z.enum(['asleep', 'starting', 'awake', 'failed']);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

/** Size of one task as the task definition declares it: CPU units (1024 = 1 vCPU) and MiB. */
export const taskSizeSchema = z.object({
  cpu: z.number().int().nonnegative(),
  memory: z.number().int().nonnegative(),
});
export type TaskSize = z.infer<typeof taskSizeSchema>;

export const scalingBoundsSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const serviceViewSchema = z.object({
  name: serviceNameSchema,
  status: serviceStatusSchema,
  desired: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  /** Epoch seconds of the last request, when known. */
  lastActivity: z.number().int().positive().optional(),
  /** Idle seconds before the service is put to sleep. */
  cooldownS: z.number().int().nonnegative(),
  alwaysOn: z.boolean(),
  bounds: scalingBoundsSchema.optional(),
  taskDefinition: z.string().optional(),
  /** Missing when ECS has no task definition revision for the service yet. */
  task: taskSizeSchema.optional(),
});
export type ServiceView = z.infer<typeof serviceViewSchema>;

export const servicesListOutputSchema = z.array(serviceViewSchema);

export const serviceActionOutputSchema = z.object({
  service: serviceNameSchema,
  action: z.enum(['wake', 'sleep', 'redeploy']),
  at: isoDateTimeSchema,
});
export type ServiceActionOutput = z.infer<typeof serviceActionOutputSchema>;

export const wakeAllOutputSchema = z.object({
  action: z.literal('wake-all'),
  at: isoDateTimeSchema,
});

export const cooldownInputSchema = z.object({
  name: serviceNameSchema,
  /** 0 = back to the configured default. */
  seconds: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 3600),
});
export const cooldownOutputSchema = z.object({ service: serviceNameSchema, cooldownS: z.number() });

export const boundsInputSchema = z
  .object({
    name: serviceNameSchema,
    min: z.number().int().min(0).max(20),
    max: z.number().int().min(1).max(20),
  })
  .refine((b) => b.min <= b.max, { message: 'min > max', path: ['min'] });
export const boundsOutputSchema = z.object({
  service: serviceNameSchema,
  bounds: scalingBoundsSchema,
});

/**
 * One Aurora cluster. Capacity is in ACU (1 ACU ≈ 2 GiB RAM plus the matching CPU; AWS publishes no fixed vCPU
 * per ACU); 0 ACU means a Serverless v2 cluster is paused and costs nothing.
 */
export const databaseViewSchema = z.object({
  clusterId: z.string(),
  /** RDS cluster status (`available`, `stopped`, `backing-up`, …). */
  status: z.string(),
  engine: z.string().optional(),
  engineVersion: z.string().optional(),
  /** Current capacity from CloudWatch `ServerlessDatabaseCapacity`; missing when no datapoint exists. */
  acu: z.number().nonnegative().optional(),
  paused: z.boolean(),
  minAcu: z.number().nonnegative().optional(),
  maxAcu: z.number().nonnegative().optional(),
  /** Epoch seconds of the capacity datapoint. */
  measuredAt: z.number().int().positive().optional(),
});
export type DatabaseView = z.infer<typeof databaseViewSchema>;

export const databasesListOutputSchema = z.array(databaseViewSchema);
