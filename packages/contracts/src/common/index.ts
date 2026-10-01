import { z } from 'zod';

/** UUID v4 primary keys everywhere. */
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Cursor-less pagination shared by every list procedure. */
export const pageInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
export type PageInput = z.infer<typeof pageInputSchema>;

/** Mirrors `Paginated<T>` from @bf/shared/interfaces as a zod factory. */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    object: z.literal('list'),
    data: z.array(item),
    hasMore: z.boolean(),
    total: z.number().int().nonnegative().optional(),
  });

/** Every service exposes `health.ping` so the edge and smoke tests can talk to it via tRPC. */
export const pingInputSchema = z.object({ echo: z.string().max(64).optional() }).default({});
export const pingOutputSchema = z.object({
  service: z.string(),
  ok: z.literal(true),
  echo: z.string().optional(),
  at: isoDateTimeSchema,
});
export type PingOutput = z.infer<typeof pingOutputSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
