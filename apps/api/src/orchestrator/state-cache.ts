import type { EcsApi, ServiceState } from './ecs-api';

/**
 * Per-task cache of DescribeServices (default 10 s): one request per sweep/wake instead of one per HTTP request,
 * and concurrent callers share one in-flight call. Never shared between api tasks — ECS is the source of truth.
 */
export class ServiceStateCache {
  private readonly entries = new Map<string, { at: number; state: ServiceState }>();
  private inflight?: Promise<void>;

  constructor(
    private readonly api: EcsApi,
    private readonly now: () => number = Date.now,
  ) {}

  async get(names: string[], maxAgeMs = 10_000): Promise<Map<string, ServiceState>> {
    const stale = names.filter((n) => {
      const e = this.entries.get(n);
      return !e || this.now() - e.at > maxAgeMs;
    });
    if (stale.length) {
      if (!this.inflight) {
        // refresh everything that is stale (not only the caller's names) so parallel callers can reuse it
        const toFetch = [...new Set([...stale, ...this.staleNames(maxAgeMs)])];
        this.inflight = this.api
          .describeServices(toFetch)
          .then((states) => {
            const at = this.now();
            for (const state of states) this.entries.set(state.name, { at, state });
          })
          .finally(() => (this.inflight = undefined));
      }
      await this.inflight;
    }
    const out = new Map<string, ServiceState>();
    for (const n of names) {
      const e = this.entries.get(n);
      if (e) out.set(n, e.state);
    }
    return out;
  }

  private staleNames(maxAgeMs: number): string[] {
    return [...this.entries.entries()]
      .filter(([, e]) => this.now() - e.at > maxAgeMs)
      .map(([n]) => n);
  }

  invalidate(name?: string): void {
    if (name) this.entries.delete(name);
    else this.entries.clear();
  }
}
