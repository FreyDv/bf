import { z } from 'zod';

/** `<context>.<aggregate>.<event>` — also the Kafka topic name. */
export const eventTypeSchema = z.string().regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){2,}$/);

/**
 * Integration event envelope. The whole envelope is stored in outbox.payload (jsonb) and relayed by
 * Debezium's EventRouter as the Kafka message value, so consumers do exactly one zod parse.
 */
export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: eventTypeSchema,
  version: z.number().int().positive().default(1),
  occurredAt: z.string().datetime(),
  /** Producing service, e.g. 'api'. */
  source: z.string().min(1),
  aggregate: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  payload: z.unknown(),
});

export type EventEnvelope<P = unknown> = Omit<z.infer<typeof eventEnvelopeSchema>, 'payload'> & {
  payload: P;
};

export function parseEnvelope(raw: unknown): EventEnvelope {
  return eventEnvelopeSchema.parse(raw) as EventEnvelope;
}

export function safeParseEnvelope(
  raw: unknown,
): { ok: true; value: EventEnvelope } | { ok: false; error: string } {
  const r = eventEnvelopeSchema.safeParse(raw);
  return r.success
    ? { ok: true, value: r.data as EventEnvelope }
    : { ok: false, error: r.error.message };
}
