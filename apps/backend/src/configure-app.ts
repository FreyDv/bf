import type { INestApplication } from '@nestjs/common';

// Backend and frontend share one host, and Traefik forwards /api without stripping it (ADR-038 item 2): the prefix is
// part of every route. tRPC is not covered by it - nestjs-trpc mounts with `app.use(basePath)`, so its path is set in
// AppModule - which leaves the prefix for plain routes that come later.
export const API_PREFIX = 'api';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}
