import type { Bounds, EcsApi, ServiceState } from './ecs-api';

/** In-memory ECS for unit tests: records every call, `advance()` simulates tasks coming up or going down. */
export class FakeEcsApi implements EcsApi {
  readonly services = new Map<string, ServiceState & Bounds>();
  readonly calls: { op: string; name: string; args?: unknown }[] = [];

  constructor(names: string[], now = 0) {
    for (const name of names) {
      this.services.set(name, {
        name,
        arn: `arn:aws:ecs:us-east-1:1:service/bf-prod/bf-prod-${name}`,
        desiredCount: 0,
        runningCount: 0,
        pendingCount: 0,
        rolloutState: 'COMPLETED',
        deploymentUpdatedAt: now,
        tags: {},
        min: 0,
        max: 4,
      });
    }
  }

  advance(name: string, patch: Partial<ServiceState & Bounds>) {
    Object.assign(this.get(name), patch);
  }

  get(name: string) {
    const s = this.services.get(name);
    if (!s) throw new Error(`no service ${name}`);
    return s;
  }

  count(op: string, name?: string) {
    return this.calls.filter((c) => c.op === op && (name === undefined || c.name === name)).length;
  }

  describeServices(names: string[]): Promise<ServiceState[]> {
    this.calls.push({ op: 'describe', name: names.join(',') });
    return Promise.resolve(
      names
        .filter((n) => this.services.has(n))
        .map((n) => ({ ...this.get(n), tags: { ...this.get(n).tags } })),
    );
  }

  updateDesiredCount(name: string, desired: number): Promise<void> {
    this.calls.push({ op: 'desired', name, args: desired });
    this.get(name).desiredCount = desired;
    return Promise.resolve();
  }

  forceNewDeployment(name: string): Promise<void> {
    this.calls.push({ op: 'redeploy', name });
    return Promise.resolve();
  }

  setBounds(name: string, min: number, max: number): Promise<void> {
    this.calls.push({ op: 'bounds', name, args: { min, max } });
    Object.assign(this.get(name), { min, max });
    return Promise.resolve();
  }

  getBounds(names: string[]): Promise<Record<string, Bounds>> {
    this.calls.push({ op: 'getBounds', name: names.join(',') });
    return Promise.resolve(
      Object.fromEntries(
        names
          .filter((n) => this.services.has(n))
          .map((n) => [n, { min: this.get(n).min, max: this.get(n).max }]),
      ),
    );
  }

  tag(arn: string, tags: Record<string, string>): Promise<void> {
    const service = [...this.services.values()].find((s) => s.arn === arn);
    if (!service) throw new Error(`no service with arn ${arn}`);
    this.calls.push({ op: 'tag', name: service.name, args: tags });
    Object.assign(service.tags, tags);
    return Promise.resolve();
  }
}
