import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/**
 * Edge: JWT verification + permissions + rate limiting + reverse proxy to every service
 * (`/<service>/*`). No global prefix — the proxy owns the whole path space. Body parsing is
 * disabled so request bodies stream through untouched.
 */
void bootstrapApp(AppModule, { globalPrefix: false, bodyParser: false });
