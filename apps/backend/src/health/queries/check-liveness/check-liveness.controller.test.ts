import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module.js';
import { configureApp } from '../../../configure-app.js';

describe('GET /api/health', () => {
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

  it('answers 200 with {"status":"ok"} and nothing else', async () => {
    const response = await fetch(`${origin}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  // ADR-038: only /api reaches the backend, so the route exists under the prefix and nowhere else.
  it('does not answer without the /api prefix', async () => {
    const response = await fetch(`${origin}/health`);

    expect(response.status).toBe(404);
  });
});
