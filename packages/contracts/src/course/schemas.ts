import { z } from 'zod';

import { idSchema, isoDateTimeSchema, paginatedSchema } from '../common';

export const courseSchema = z.object({
  id: idSchema,
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  published: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type Course = z.infer<typeof courseSchema>;

export const coursesListInputSchema = z.void();
export const coursesListOutputSchema = paginatedSchema(courseSchema);
