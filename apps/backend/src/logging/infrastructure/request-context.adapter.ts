import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from '@bf/kernel';

/**
 * One object per request, created by the middleware (ENF-5: per request, not a global value). The actor slots are
 * null until authentication (AUTH-3) binds them; ADR-040 items 5 and 10 put the identity into the context from the
 * driving adapter.
 */
export interface RequestContextStore {
  readonly correlationId: string;
  actorId: string | null;
  actorSource: string | null;
}

/**
 * The AsyncLocalStorage implementation of the kernel's read-only RequestContext. Outside `run` (startup, shutdown, a
 * future entry point that did not open a context) every field is null; a NATS consumer or a worker opens its own
 * context with the same `run` (ADR-070).
 */
export class AsyncLocalRequestContext implements RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  get correlationId(): string | null {
    return this.storage.getStore()?.correlationId ?? null;
  }

  get actorId(): string | null {
    return this.storage.getStore()?.actorId ?? null;
  }

  get actorSource(): string | null {
    return this.storage.getStore()?.actorSource ?? null;
  }

  run<T>(store: RequestContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }
}
