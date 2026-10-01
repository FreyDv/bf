import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/** Identity skeleton: users + refresh tokens, issues RS256 JWTs (dev-token, refresh, logout, jwks). tRPC at /trpc. */
void bootstrapApp(AppModule);
