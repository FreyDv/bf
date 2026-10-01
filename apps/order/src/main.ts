import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/** Orders bounded context (REST + tRPC at /trpc) + attachments (S3). */
void bootstrapApp(AppModule);
