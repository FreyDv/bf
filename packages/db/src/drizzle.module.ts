import { Global, Inject, Module } from '@nestjs/common';

import { createDrizzleInstance, DRIZZLE } from './drizzle.provider';

import type { DrizzleDatabase, DrizzleModuleOptions } from './drizzle.provider';
import type {
  DynamicModule,
  InjectionToken,
  ModuleMetadata,
  OnApplicationShutdown,
} from '@nestjs/common';

export interface DrizzleAsyncOptions<S extends Record<string, unknown>> extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: InjectionToken[];
  useFactory: (...args: never[]) => DrizzleModuleOptions<S> | Promise<DrizzleModuleOptions<S>>;
}

class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase<Record<string, unknown>>) {}
  async onApplicationShutdown(): Promise<void> {
    await this.db.$client.end();
  }
}

/**
 * Global Drizzle module. Each app calls `DrizzleModule.forRootAsync` once with its own schema register,
 * and repositories inject `@Inject(DRIZZLE) db: ApiDatabase`.
 */
@Global()
@Module({})
export class DrizzleModule {
  static forRootAsync<S extends Record<string, unknown>>(
    options: DrizzleAsyncOptions<S>,
  ): DynamicModule {
    return {
      module: DrizzleModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: DRIZZLE,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) =>
            createDrizzleInstance(await options.useFactory(...args)),
        },
        PoolShutdown,
      ],
      exports: [DRIZZLE],
    };
  }
}
