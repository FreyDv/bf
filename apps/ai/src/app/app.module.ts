import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmModule, llmOptionsFromEnv } from '@bf/llm';
import { CoreModule } from '@bf/server';

import { envSchema } from './env.schema';
import { TrpcModule } from '../trpc.module';

import type { Env } from './env.schema';

@Module({
  imports: [
    CoreModule.forRoot({ envSchema }),
    LlmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        llmOptionsFromEnv({
          OPENAI_API_KEY: config.get('OPENAI_API_KEY', { infer: true }) ?? 'missing',
          OPENAI_BASE_URL: config.get('OPENAI_BASE_URL', { infer: true }),
          OPENAI_ORG_ID: config.get('OPENAI_ORG_ID', { infer: true }),
          OPENAI_MODEL: config.get('OPENAI_MODEL', { infer: true }),
          OPENAI_EMBEDDING_MODEL: config.get('OPENAI_EMBEDDING_MODEL', { infer: true }),
          OPENAI_TIMEOUT_MS: config.get('OPENAI_TIMEOUT_MS', { infer: true }),
          OPENAI_MAX_RETRIES: config.get('OPENAI_MAX_RETRIES', { infer: true }),
        }),
    }),
    TrpcModule,
  ],
})
export class AppModule {}
