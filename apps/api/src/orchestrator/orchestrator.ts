import { awakeDependents, closure } from './service-graph';

import type { Bounds, EcsApi, ServiceState, TaskSize } from './ecs-api';
import type { ServiceGraph } from './service-graph';
import type { ServiceStateCache } from './state-cache';

export const ORCHESTRATOR = Symbol.for('bf.orchestrator');

/** ECS service tags the orchestrator reads/writes (the only persistent state besides desiredCount). */
export const TAGS = { lastActivity: 'bf:last-activity', cooldown: 'bf:cooldown' } as const;

export interface OrchestratorOptions {
  graph: ServiceGraph;
  /** Every orchestrated service → its port (from UPSTREAMS). */
  ports: Record<string, number>;
  alwaysOn: string[];
  defaultCooldownS: number;
  cooldowns: Record<string, number>;
  maxTasks: Record<string, number>;
  defaultMaxTasks: number;
  /** How long a request is held while the service starts. */
  wakeTimeoutMs: number;
  /** `desiredCount ≥ 1` with no running task for this long → give up (back to 0). */
  failAfterMs: number;
  /** Minimum interval between two `bf:last-activity` writes per service. */
  activityThrottleMs?: number;
}

export type ServiceStatus = 'asleep' | 'starting' | 'awake' | 'failed';

export interface ServiceView {
  name: string;
  status: ServiceStatus;
  desired: number;
  running: number;
  /** Epoch seconds, when known. */
  lastActivity?: number;
  cooldownS: number;
  alwaysOn: boolean;
  bounds?: Bounds;
  taskDefinition?: string;
  /** Size of one task (from the task definition); missing when ECS has no revision for the service yet. */
  task?: TaskSize;
}

export interface WakeResult {
  ready: boolean;
  waitedMs: number;
  /** Services still not answering when the hold timed out. */
  pending: string[];
}

export interface Orchestrator {
  readonly enabled: boolean;
  /** True for a service this orchestrator manages. */
  has(service: string): boolean;
  /** Wakes `service` and its dependencies, holds until they answer (or the timeout). Records activity. */
  ensureAwake(service: string): Promise<WakeResult>;
  isAsleep(service: string): Promise<boolean>;
  recordActivity(service: string): void;
  invalidate(service?: string): void;
  list(): Promise<ServiceView[]>;
  wake(service: string): Promise<void>;
  /** Wakes every managed service that is asleep (the dashboard's "wake all"). */
  wakeAll(): Promise<void>;
  sleep(service: string): Promise<void>;
  setCooldown(service: string, seconds: number): Promise<void>;
  setBounds(service: string, min: number, max: number): Promise<void>;
  redeploy(service: string): Promise<void>;
  /** One pass of the idle sweep (every api task runs it once a minute). */
  sweep(): Promise<void>;
}

export interface OrchestratorLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Local mode (`ORCHESTRATOR=none`): nothing sleeps, nothing is called. */
export class NoopOrchestrator implements Orchestrator {
  readonly enabled = false;
  has(): boolean {
    return false;
  }
  ensureAwake(): Promise<WakeResult> {
    return Promise.resolve({ ready: true, waitedMs: 0, pending: [] });
  }
  isAsleep(): Promise<boolean> {
    return Promise.resolve(false);
  }
  recordActivity(): void {}
  invalidate(): void {}
  list(): Promise<ServiceView[]> {
    return Promise.resolve([]);
  }
  wake(): Promise<void> {
    return Promise.resolve();
  }
  wakeAll(): Promise<void> {
    return Promise.resolve();
  }
  sleep(): Promise<void> {
    return Promise.resolve();
  }
  setCooldown(): Promise<void> {
    return Promise.resolve();
  }
  setBounds(): Promise<void> {
    return Promise.resolve();
  }
  redeploy(): Promise<void> {
    return Promise.resolve();
  }
  sweep(): Promise<void> {
    return Promise.resolve();
  }
}

const event = (data: Record<string, unknown>) => JSON.stringify(data);

/**
 * Scale-to-zero controller for the ECS services behind the edge. State lives in ECS only:
 * desiredCount/runningCount say who is awake, the service tags carry last activity and the cooldown override.
 * Every call is idempotent, so several api tasks running the same logic at once is harmless.
 */
export class EcsOrchestrator implements Orchestrator {
  readonly enabled = true;
  private readonly names: string[];
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly lastTagged = new Map<string, number>();
  /** When THIS task asked for a service to start (failure rule fallback). */
  private readonly startedAt = new Map<string, number>();
  private readonly activityThrottleMs: number;

  constructor(
    private readonly api: EcsApi,
    private readonly cache: ServiceStateCache,
    private readonly opts: OrchestratorOptions,
    private readonly probe: (url: string) => Promise<boolean>,
    private readonly logger: OrchestratorLogger,
    private readonly now: () => number = Date.now,
    private readonly sleepMs: (ms: number) => Promise<void> = (ms) =>
      new Promise((done) => setTimeout(done, ms)),
  ) {
    this.names = Object.keys(opts.ports);
    this.activityThrottleMs = opts.activityThrottleMs ?? 30_000;
  }

  has(service: string): boolean {
    return service in this.opts.ports;
  }

  private assertKnown(service: string) {
    if (!this.has(service)) throw new Error(`unknown service ${service}`);
  }

  private maxTasks(service: string) {
    return this.opts.maxTasks[service] ?? this.opts.defaultMaxTasks;
  }

  private cooldownOf(state: ServiceState) {
    const tag = Number(state.tags[TAGS.cooldown]);
    if (Number.isFinite(tag) && tag > 0) return tag;
    return this.opts.cooldowns[state.name] ?? this.opts.defaultCooldownS;
  }

  private lastActivityOf(state: ServiceState): number | undefined {
    const tag = Number(state.tags[TAGS.lastActivity]);
    return Number.isFinite(tag) && tag > 0 ? tag : undefined;
  }

  /**
   * Epoch seconds when the service was (last) asked to run: the PRIMARY deployment's update (ECS refreshes it on a
   * desiredCount change) or, if this task issued the wake, the local timestamp. Activity tags do not count — a
   * steady stream of requests must not keep resetting the failure clock.
   */
  private startedSince(state: ServiceState): number {
    const local = Math.floor((this.startedAt.get(state.name) ?? 0) / 1000);
    return Math.max(state.deploymentUpdatedAt, local);
  }

  private isFailed(state: ServiceState): boolean {
    if (state.desiredCount < 1 || state.runningCount >= 1) return false;
    if (state.rolloutState === 'FAILED') return true;
    return this.now() / 1000 - this.startedSince(state) > this.opts.failAfterMs / 1000;
  }

  private status(state: ServiceState): ServiceStatus {
    if (state.desiredCount < 1) return 'asleep';
    if (state.runningCount >= 1) return 'awake';
    return this.isFailed(state) ? 'failed' : 'starting';
  }

  // ------------------------------------------------------------------ transitions (idempotent)

  private startService(name: string): Promise<void> {
    const running = this.inflight.get(name);
    if (running) return running;
    const p = (async () => {
      this.startedAt.set(name, this.now());
      await this.api.setBounds(name, 1, this.maxTasks(name));
      await this.api.updateDesiredCount(name, 1);
      this.cache.invalidate(name);
      this.logger.log(event({ event: 'wake', service: name }));
    })().finally(() => this.inflight.delete(name));
    this.inflight.set(name, p);
    return p;
  }

  private async stopService(name: string, reason: 'idle' | 'manual' | 'failed') {
    await this.api.setBounds(name, 0, 0);
    await this.api.updateDesiredCount(name, 0);
    this.cache.invalidate(name);
    this.startedAt.delete(name);
    if (reason === 'failed') this.logger.error(event({ event: 'wake_failed', service: name }));
    else this.logger.log(event({ event: 'sleep', service: name, reason }));
  }

  // ------------------------------------------------------------------ request path

  async ensureAwake(service: string): Promise<WakeResult> {
    if (!this.has(service)) return { ready: true, waitedMs: 0, pending: [] };
    const names = closure(this.opts.graph, service).filter((n) => this.has(n));
    const started = this.now();
    this.recordActivity(service);

    let states = await this.cache.get(names);
    const toProbe = new Set<string>();
    await Promise.all(
      names.map(async (n) => {
        const s = states.get(n);
        if (!s || s.desiredCount < 1) {
          toProbe.add(n);
          await this.startService(n);
        } else if (s.runningCount < 1) toProbe.add(n);
      }),
    );
    // fast path: everything was already running, nothing to wait for
    if (!toProbe.size) return { ready: true, waitedMs: 0, pending: [] };

    let delay = 1000;
    for (;;) {
      states = await this.cache.get(names, 2000);
      const pending: string[] = [];
      for (const n of toProbe) {
        const s = states.get(n);
        if (!s) {
          pending.push(n);
          continue;
        }
        if (this.isFailed(s)) {
          await this.stopService(n, 'failed');
          return { ready: false, waitedMs: this.now() - started, pending: [n] };
        }
        if (s.runningCount < 1 || !(await this.probeService(n))) pending.push(n);
        else toProbe.delete(n);
      }
      if (!pending.length) return { ready: true, waitedMs: this.now() - started, pending: [] };
      if (this.now() - started >= this.opts.wakeTimeoutMs)
        return { ready: false, waitedMs: this.now() - started, pending };
      await this.sleepMs(delay);
      delay = Math.min(delay * 1.5, 3000);
    }
  }

  private async probeService(name: string): Promise<boolean> {
    try {
      return await this.probe(`http://${name}:${this.opts.ports[name]}/health/live`);
    } catch {
      return false;
    }
  }

  async isAsleep(service: string): Promise<boolean> {
    if (!this.has(service)) return false;
    const state = (await this.cache.get([service])).get(service);
    return !state || state.desiredCount < 1;
  }

  recordActivity(service: string): void {
    if (!this.has(service)) return;
    const at = this.now();
    const last = this.lastTagged.get(service) ?? 0;
    if (at - last < this.activityThrottleMs) return;
    this.lastTagged.set(service, at);
    void this.cache
      .get([service])
      .then((states) => {
        const state = states.get(service);
        if (!state) throw new Error(`service ${service} not found in ECS`);
        state.tags[TAGS.lastActivity] = String(Math.floor(at / 1000));
        return this.api.tag(state.arn, { [TAGS.lastActivity]: String(Math.floor(at / 1000)) });
      })
      .catch((error: unknown) => {
        this.lastTagged.delete(service);
        this.logger.warn(
          event({
            event: 'activity_tag_failed',
            service,
            error: String((error as Error).message ?? error),
          }),
        );
      });
  }

  invalidate(service?: string): void {
    this.cache.invalidate(service);
  }

  // ------------------------------------------------------------------ admin surface

  async list(): Promise<ServiceView[]> {
    const [states, bounds] = await Promise.all([
      this.cache.get(this.names, 0),
      this.api.getBounds(this.names),
    ]);
    const sizes = await this.taskSizes([...states.values()]);
    return this.names.map((name) => {
      const s = states.get(name);
      if (!s) {
        return {
          name,
          status: 'asleep',
          desired: 0,
          running: 0,
          cooldownS: this.opts.cooldowns[name] ?? this.opts.defaultCooldownS,
          alwaysOn: this.opts.alwaysOn.includes(name),
          bounds: bounds[name],
        };
      }
      return {
        name,
        status: this.status(s),
        desired: s.desiredCount,
        running: s.runningCount,
        lastActivity: this.lastActivityOf(s),
        cooldownS: this.cooldownOf(s),
        alwaysOn: this.opts.alwaysOn.includes(name),
        bounds: bounds[name],
        taskDefinition: s.taskDefinition,
        task: s.taskDefinition ? sizes.get(s.taskDefinition) : undefined,
      };
    });
  }

  /** Task sizes by task definition ARN; a lookup that fails only leaves that service without a size. */
  private async taskSizes(states: ServiceState[]): Promise<Map<string, TaskSize>> {
    const arns = [...new Set(states.map((s) => s.taskDefinition).filter((a): a is string => !!a))];
    const out = new Map<string, TaskSize>();
    await Promise.all(
      arns.map(async (arn) => {
        try {
          out.set(arn, await this.api.describeTaskDefinition(arn));
        } catch (error) {
          this.logger.warn(
            event({
              event: 'task_definition_failed',
              taskDefinition: arn,
              error: String((error as Error).message ?? error),
            }),
          );
        }
      }),
    );
    return out;
  }

  async wake(service: string): Promise<void> {
    this.assertKnown(service);
    for (const n of closure(this.opts.graph, service).filter((x) => this.has(x))) {
      const s = (await this.cache.get([n])).get(n);
      if (!s || s.desiredCount < 1) await this.startService(n);
    }
    this.recordActivity(service);
  }

  async wakeAll(): Promise<void> {
    const states = await this.cache.get(this.names);
    await Promise.all(
      this.names.map(async (n) => {
        const s = states.get(n);
        if (!s || s.desiredCount < 1) await this.startService(n);
        this.recordActivity(n);
      }),
    );
  }

  async sleep(service: string): Promise<void> {
    this.assertKnown(service);
    await this.stopService(service, 'manual');
  }

  async setCooldown(service: string, seconds: number): Promise<void> {
    this.assertKnown(service);
    const s = (await this.cache.get([service])).get(service);
    if (!s) throw new Error(`service ${service} not found in ECS`);
    await this.api.tag(s.arn, { [TAGS.cooldown]: String(seconds) });
    this.cache.invalidate(service);
  }

  async setBounds(service: string, min: number, max: number): Promise<void> {
    this.assertKnown(service);
    await this.api.setBounds(service, min, max);
  }

  async redeploy(service: string): Promise<void> {
    this.assertKnown(service);
    await this.api.forceNewDeployment(service);
    this.cache.invalidate(service);
  }

  // ------------------------------------------------------------------ sweep

  async sweep(): Promise<void> {
    const states = await this.cache.get(this.names, 0);
    const bounds = await this.api.getBounds(this.names);
    const nowS = this.now() / 1000;
    const isAwake = (n: string) => (states.get(n)?.desiredCount ?? 0) >= 1;

    for (const name of this.names) {
      const s = states.get(name);
      if (!s) continue;
      const alwaysOn = this.opts.alwaysOn.includes(name);
      if (alwaysOn) {
        if ((bounds[name]?.min ?? 1) < 1) await this.api.setBounds(name, 1, this.maxTasks(name));
        if (s.desiredCount < 1) await this.startService(name);
        continue;
      }
      if (s.desiredCount < 1) continue;
      if (this.isFailed(s)) {
        await this.stopService(name, 'failed');
        continue;
      }
      if (s.runningCount < 1) continue; // still starting
      const idleS = nowS - (this.lastActivityOf(s) ?? s.deploymentUpdatedAt);
      const dependents = awakeDependents(this.opts.graph, name, isAwake);
      if (idleS > this.cooldownOf(s) && dependents.length === 0) {
        await this.stopService(name, 'idle');
        continue;
      }
      // reconcile: an awake service whose scalable target says min 0 would be scaled to 0 by target tracking
      if (bounds[name] && bounds[name].min < 1)
        await this.api.setBounds(name, 1, this.maxTasks(name));
    }
  }
}
