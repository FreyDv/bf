import { Global, Inject, Module } from '@nestjs/common';

import { OpenAiLlm } from './openai.llm';
import { LLM } from './port';

import type { LlmOptions } from './env';
import type { DynamicModule, InjectionToken, ModuleMetadata } from '@nestjs/common';

export interface LlmAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  useFactory: (...args: never[]) => LlmOptions | Promise<LlmOptions>;
}

@Global()
@Module({})
export class LlmModule {
  static forRootAsync(options: LlmAsyncOptions): DynamicModule {
    return {
      module: LlmModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: LLM,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) => new OpenAiLlm(await options.useFactory(...args)),
        },
      ],
      exports: [LLM],
    };
  }
}

export const InjectLlm = () => Inject(LLM);
