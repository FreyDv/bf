/**
 * Who and what the current request is, read-only (ENF-5). `correlationId` is null outside a request (startup,
 * shutdown); `actorId` and `actorSource` are null until authentication binds them (ADR-040 items 5 and 10).
 */
export interface RequestContext {
  readonly correlationId: string | null;
  readonly actorId: string | null;
  readonly actorSource: string | null;
}
