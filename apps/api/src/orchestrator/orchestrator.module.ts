import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabasesRouter } from './databases.router';
import { DB_API, SdkRdsApi } from './db-api';
import { ECS_API, SdkEcsApi } from './ecs-api';
import { EcsOrchestrator, NoopOrchestrator, ORCHESTRATOR } from './orchestrator';
import { ServicesRouter } from './services.router';
import { ServiceStateCache } from './state-cache';
import { SweepService } from './sweep.service';
import { WakeMiddleware } from './wake.middleware';

import type { DbApi } from './db-api';
import type { EcsApi } from './ecs-api';
import type { Orchestrator, OrchestratorOptions } from './orchestrator';
import type { Env } from '../app/env.schema';

const PROBE_TIMEOUT_MS = 2000;

/** `GET http://<svc>:<port>/health/live` through Service Connect; false on any error. */
export async function fetchProbe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

export function optionsFromEnv(config: ConfigService<Env, true>): OrchestratorOptions {
  const upstreams = config.get('UPSTREAMS', { infer: true });
  const ports = Object.fromEntries(
    Object.entries(upstreams).map(([name, url]) => {
      const u = new URL(url);
      return [name, Number(u.port || (u.protocol === 'https:' ? 443 : 80))];
    }),
  );
  const numbers = (record: Record<string, string>, label: string) =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new Error(`${label}: ${k}=${v} is not a number`);
        return [k, n];
      }),
    );
  return {
    graph: config.get('SERVICE_GRAPH', { infer: true }),
    ports,
    alwaysOn: config.get('ALWAYS_ON', { infer: true }),
    defaultCooldownS: config.get('DEFAULT_COOLDOWN_S', { infer: true }),
    cooldowns: numbers(config.get('SERVICE_COOLDOWNS', { infer: true }), 'SERVICE_COOLDOWNS'),
    maxTasks: numbers(config.get('SERVICE_MAX_TASKS', { infer: true }), 'SERVICE_MAX_TASKS'),
    defaultMaxTasks: 4,
    wakeTimeoutMs: config.get('WAKE_TIMEOUT_MS', { infer: true }),
    failAfterMs: config.get('WAKE_FAIL_AFTER_MS', { infer: true }),
  };
}

/**
 * Scale-to-zero orchestrator for the services behind the edge. `ORCHESTRATOR=none` (local, default): a no-op,
 * no AWS SDK client is created. `ORCHESTRATOR=ecs`: wakes services on demand (WakeMiddleware), puts idle ones to
 * sleep (SweepService) and exposes the admin surface as tRPC routers (`/_services/trpc`, contract
 * `@bf/contracts/api`). See infra/aws/README.md. On ECS the same surface lists the account's Aurora clusters
 * (`databases.list`), discovered through the SDK.
 */
@Module({
  providers: [
    {
      provide: DB_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): DbApi | null =>
        config.get('ORCHESTRATOR', { infer: true }) === 'ecs' ? new SdkRdsApi() : null,
    },
    {
      provide: ECS_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EcsApi | null =>
        config.get('ORCHESTRATOR', { infer: true }) === 'ecs'
          ? new SdkEcsApi(
              config.get('ECS_CLUSTER', { infer: true }) ?? '',
              config.get('ECS_SERVICE_PREFIX', { infer: true }),
            )
          : null,
    },
    {
      provide: ORCHESTRATOR,
      inject: [ConfigService, ECS_API],
      useFactory: (config: ConfigService<Env, true>, api: EcsApi | null): Orchestrator => {
        if (config.get('ORCHESTRATOR', { infer: true }) !== 'ecs' || !api)
          return new NoopOrchestrator();
        const logger = new Logger(EcsOrchestrator.name);
        return new EcsOrchestrator(
          api,
          new ServiceStateCache(api),
          optionsFromEnv(config),
          fetchProbe,
          {
            log: (m) => logger.log(m),
            warn: (m) => logger.warn(m),
            error: (m) => logger.error(m),
          },
        );
      },
    },
    WakeMiddleware,
    SweepService,
    ServicesRouter,
    DatabasesRouter,
  ],
  exports: [ORCHESTRATOR, WakeMiddleware],
})
export class OrchestratorModule {}
