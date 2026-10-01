import { Global, Inject, Module } from '@nestjs/common';

import { OBJECT_STORAGE } from './port';
import { S3ObjectStorage } from './s3.storage';

import type { StorageOptions } from './env';
import type {
  DynamicModule,
  InjectionToken,
  ModuleMetadata,
  OnApplicationShutdown,
} from '@nestjs/common';

export interface StorageAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  useFactory: (...args: never[]) => StorageOptions | Promise<StorageOptions>;
}

class StorageShutdown implements OnApplicationShutdown {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: S3ObjectStorage) {}
  async onApplicationShutdown(): Promise<void> {
    if (this.storage instanceof S3ObjectStorage) await this.storage.destroy();
  }
}

@Global()
@Module({})
export class StorageModule {
  static forRootAsync(options: StorageAsyncOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: OBJECT_STORAGE,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) =>
            new S3ObjectStorage(await options.useFactory(...args)),
        },
        StorageShutdown,
      ],
      exports: [OBJECT_STORAGE],
    };
  }
}

export const InjectStorage = () => Inject(OBJECT_STORAGE);
