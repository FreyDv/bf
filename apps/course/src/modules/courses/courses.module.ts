import { Module } from '@nestjs/common';

import { CoursesRouter } from './courses.router';

@Module({ providers: [CoursesRouter] })
export class CoursesModule {}
