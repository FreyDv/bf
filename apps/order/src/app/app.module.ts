import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { sql } from 'drizzle-orm';

import { buildPostgresUrl, DRIZZLE, DrizzleModule } from '@bf/db';
import { EventsModule } from '@bf/events';
import { CoreModule } from '@bf/server';
import { StorageModule, storageOptionsFromEnv } from '@bf/storage';

import { envSchema } from './env.schema';
import * as schema from '../db/schema.register';
import { TrpcModule } from '../trpc.module';

import type { Env } from './env.schema';
import type { OrderDatabase } from '../db/database.type';

@Module({
  imports: [
    CoreModule.forRoot({
      envSchema,
      envFilePaths: ['../../infra/postgres/.env'],
      readiness: {
        inject: [DRIZZLE],
        useFactory: (db: OrderDatabase) => [
          async () => {
            await db.execute(sql`select 1`);
            return { database: { status: 'up' } };
          },
        ],
      },
    }),
    CqrsModule.forRoot(),
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connectionString: buildPostgresUrl({
          POSTGRES_HOST: config.get('POSTGRES_HOST', { infer: true }),
          POSTGRES_PORT: config.get('POSTGRES_PORT', { infer: true }),
          POSTGRES_DB: config.get('POSTGRES_DB', { infer: true }),
          POSTGRES_USER: config.get('POSTGRES_USER', { infer: true }),
          POSTGRES_PASSWORD: config.get('POSTGRES_PASSWORD', { infer: true }),
          POSTGRES_SSL: config.get('POSTGRES_SSL', { infer: true }),
        }),
        schema,
        pool: {
          max: config.get('DB_POOL_MAX', { infer: true }),
          min: config.get('DB_POOL_MIN', { infer: true }),
          connectionTimeoutMillis: config.get('DB_CONNECT_TIMEOUT_MS', { infer: true }),
        },
      }),
    }),
    EventsModule.forRoot({ source: 'order', outbox: schema.outbox }),
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        storageOptionsFromEnv({
          S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
          S3_REGION: config.get('S3_REGION', { infer: true }),
          S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
          S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
          S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
          S3_FORCE_PATH_STYLE: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          S3_PRESIGN_TTL: config.get('S3_PRESIGN_TTL', { infer: true }),
        }),
    }),
    TrpcModule,
  ],
})
export class AppModule {}
