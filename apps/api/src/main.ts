import { json } from 'express';

import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/**
 * Edge: JWT verification + permissions + rate limiting + reverse proxy to every service
 * (`/<service>/*`). No global prefix — the proxy owns the whole path space. Body parsing is
 * disabled so request bodies stream through untouched; only the edge's own tRPC procedures
 * (`/_services/trpc`, never an upstream name) parse JSON.
 */
void bootstrapApp(AppModule, {
  globalPrefix: false,
  bodyParser: false,
  configure: (app) => {
    app.use('/_services', json({ limit: '1kb' }));
  },
});
