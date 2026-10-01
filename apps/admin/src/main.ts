import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/** Back-office aggregation (skeleton). tRPC at /trpc. */
void bootstrapApp(AppModule);
