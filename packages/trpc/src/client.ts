import { Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { ClsService } from 'nestjs-cls';

import { CLS_KEYS, HEADERS } from '@bf/shared/constants';

import { identityHeaders } from './context';
import { TRPC_BASE_PATH } from './server';

import type { AuthenticatedUser } from '@bf/shared/interfaces';
import type { DynamicModule } from '@nestjs/common';
import type { TRPCClient, TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';

export type TrpcClient<TRouter extends AnyRouter> = TRPCClient<TRouter>;

/** Injection token for the client of `<name>` (`@InjectTrpcClient('auth')`). */
export const TRPC_CLIENT = (name: string) => Symbol.for(`bf.trpc.client.${name}`);
export const InjectTrpcClient = (name: string) => Inject(TRPC_CLIENT(name));

export interface TrpcClientModuleOptions {
  /** Upstream service name (`auth`, `order`, …); also used for the injection token. */
  name: string;
  /** Env var holding the base URL of the upstream (default `<NAME>_URL`, e.g. `AUTH_URL`). */
  urlEnv?: string;
}

/**
 * A tRPC client is a recursive Proxy: *every* property looks like a procedure, so Nest's lifecycle
 * scan (`typeof instance.onModuleInit === 'function'`) would call `client.onModuleInit()` and crash.
 * Hide the keys Nest (and JSON/Promise machinery) probe for.
 */
const NON_PROCEDURE_KEYS = new Set<string | symbol>([
  'onModuleInit',
  'onApplicationBootstrap',
  'onModuleDestroy',
  'beforeApplicationShutdown',
  'onApplicationShutdown',
  'then',
  'catch',
  'finally',
  'toJSON',
  // NOTE: `constructor` must stay visible — nestjs-trpc's provider scan calls Reflect.getMetadata on it.
]);
function nestSafe<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol' || NON_PROCEDURE_KEYS.has(prop)) return undefined;
      return Reflect.get(target, prop, receiver) as unknown;
    },
  });
}

/**
 * Typed `@trpc/client` for one upstream service. Propagates the correlation id and, when the
 * current request carries an identity (CLS), the caller's identity headers — so a chain
 * fe → api → order → auth keeps the same user and trace.
 */
@Module({})
export class TrpcClientModule {
  static register<TRouter extends AnyRouter>(options: TrpcClientModuleOptions): DynamicModule {
    const token = TRPC_CLIENT(options.name);
    const urlEnv = options.urlEnv ?? `${options.name.toUpperCase()}_URL`;
    return {
      module: TrpcClientModule,
      providers: [
        {
          provide: token,
          inject: [ConfigService, { token: ClsService, optional: true }],
          useFactory: (config: ConfigService, cls?: ClsService): TrpcClient<TRouter> => {
            const base = config.get<string>(urlEnv);
            if (!base)
              throw new Error(
                `${urlEnv} is not set (needed by TrpcClientModule '${options.name}')`,
              );
            const client = createServiceClient<TRouter>(base, () => {
              const correlationId = cls?.get<string>(CLS_KEYS.CORRELATION_ID);
              return {
                ...(correlationId ? { [HEADERS.CORRELATION_ID]: correlationId } : {}),
                ...identityHeaders(cls?.get<AuthenticatedUser>(CLS_KEYS.USER)),
              };
            });
            return nestSafe(client);
          },
        },
      ],
      exports: [token],
    };
  }
}

/** Framework-free factory (Next.js, scripts, tests). */
export function createServiceClient<TRouter extends AnyRouter>(
  baseUrl: string,
  headers: () => Record<string, string> | Promise<Record<string, string>> = () => ({}),
): TrpcClient<TRouter> {
  // Contracts never use a data transformer, so the generic `transformer` requirement is moot.
  const link = httpBatchLink({
    url: new URL(TRPC_BASE_PATH, baseUrl).toString(),
    headers,
  }) as unknown as TRPCLink<TRouter>;
  return createTRPCClient<TRouter>({ links: [link] });
}
