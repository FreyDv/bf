/**
 * Requires Postgres (database "auth", migrations applied). Run: pnpm --filter auth test:e2e
 * Covers: dev-token → RS256 pair, JWKS, refresh rotation.
 */
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { bootstrapApp } from '@bf/server';

import { AppModule } from '../src/app/app.module';

import type { INestApplication } from '@nestjs/common';

describe('auth (e2e)', () => {
  let app: INestApplication;
  let refreshToken: string;

  beforeAll(async () => {
    // env is prepared in test/setup-env.ts
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app = await bootstrapApp(AppModule, { listen: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('mints a dev token pair and exposes the public key as JWKS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/dev-token')
      .send({ sub: `e2e-${Date.now()}`, roles: ['user'] })
      .expect(201);
    expect(res.body.tokenType).toBe('Bearer');
    refreshToken = res.body.refreshToken;

    const jwks = await request(app.getHttpServer()).get('/api/auth/jwks').expect(200);
    expect(jwks.body.keys[0].alg).toBe('RS256');
  });

  it('rotates refresh tokens (old one is revoked)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });
});
