import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

describe('AppModule', () => {
  let app: INestApplication;
  let origin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  // ADR-038: Traefik sends /api to the backend without stripping it, so tRPC answers under /api/trpc and nowhere else.
  it('serves tRPC under /api/trpc: an unknown procedure is a tRPC NOT_FOUND error', async () => {
    const response = await fetch(`${origin}/api/trpc/x`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: { data?: { code?: string } } };
    expect(body.error?.data?.code).toBe('NOT_FOUND');
  });

  it('does not serve tRPC under /trpc', async () => {
    const response = await fetch(`${origin}/trpc/x`);
    expect(response.status).toBe(404);
    // Express's own 404 page, or Nest's JSON: either way not a tRPC error.
    expect(await response.text()).not.toContain('"NOT_FOUND"');
  });
});
