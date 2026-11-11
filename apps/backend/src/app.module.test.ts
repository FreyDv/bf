import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('boots with the tRPC module on Nest 12', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
    expect(app).toBeDefined();
  });
});
