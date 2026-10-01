/** `@bf/llm/port` — framework-free LLM contract. */
import type { ZodType } from 'zod';

export const LLM = Symbol.for('bf.LLM');

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface CompleteInput {
  messages: LlmMessage[];
  /** Convenience: prepended as a system message. */
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Per-call timeout in ms (overrides module default). */
  timeoutMs?: number;
  /** Free-form metadata for logging/metrics (e.g. feature name). */
  tag?: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompleteResult {
  text: string;
  model: string;
  usage?: LlmUsage;
  finishReason?: string;
}

export interface StructuredResult<T> extends Omit<CompleteResult, 'text'> {
  data: T;
  raw: string;
}

export interface EmbedResult {
  vectors: number[][];
  model: string;
  usage?: Pick<LlmUsage, 'promptTokens' | 'totalTokens'>;
}

export interface LlmPort {
  complete(input: CompleteInput): Promise<CompleteResult>;
  /** JSON output validated against `schema` (OpenAI structured outputs under the hood). */
  completeStructured<T>(
    schema: ZodType<T>,
    input: CompleteInput & { schemaName?: string },
  ): Promise<StructuredResult<T>>;
  embed(texts: string[], model?: string): Promise<EmbedResult>;
}
