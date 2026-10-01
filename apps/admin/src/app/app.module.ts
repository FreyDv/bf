import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';

import { buildPostgresUrl, DRIZZLE, DrizzleModule } from '@bf/db';
import { CoreModule } from '@bf/server';

import { envSchema } from './env.schema';
import * as schema from '../db/schema.register';
import { TrpcModule } from '../trpc.module';

import type { Env } from './env.schema';
import type { AdminDatabase } from '../db/database.type';

@Module({
  imports: [
    CoreModule.forRoot({
      envSchema,
      envFilePaths: ['../../infra/postgres/.env'],
      readiness: {
        inject: [DRIZZLE],
        useFactory: (db: AdminDatabase) => [
          async () => {
            await db.execute(sql`select 1`);
            return { database: { status: 'up' } };
          },
        ],
      },
    }),
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
    TrpcModule,
  ],
})
export class AppModule {}
