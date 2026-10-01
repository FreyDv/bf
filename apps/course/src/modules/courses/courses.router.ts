import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Query, Router } from 'nestjs-trpc';

import { coursesListInputSchema, coursesListOutputSchema } from '@bf/contracts/course';
import { DRIZZLE } from '@bf/db';

import { courses } from './course.schema';

import type { CourseDatabase } from '../../db/database.type';

@Router({ alias: 'courses' })
export class CoursesRouter {
  constructor(@Inject(DRIZZLE) private readonly db: CourseDatabase) {}

  /** Public catalogue: published courses only. */
  @Query({ input: coursesListInputSchema, output: coursesListOutputSchema })
  async list() {
    const rows = await this.db.select().from(courses).where(eq(courses.published, true)).limit(50);
    return {
      object: 'list' as const,
      data: rows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      hasMore: false,
    };
  }
}
