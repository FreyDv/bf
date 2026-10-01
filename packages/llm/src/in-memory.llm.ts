import type { CompleteInput, CompleteResult, EmbedResult, LlmPort, StructuredResult } from './port';
import type { ZodType } from 'zod';

/** Test double: scripted responses, no network. */
export class InMemoryLlm implements LlmPort {
  readonly calls: CompleteInput[] = [];
  private textQueue: string[] = [];
  private structuredQueue: unknown[] = [];

  enqueueText(...texts: string[]): this {
    this.textQueue.push(...texts);
    return this;
  }
  enqueueStructured(...objects: unknown[]): this {
    this.structuredQueue.push(...objects);
    return this;
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    this.calls.push(input);
    const text = this.textQueue.shift() ?? 'stub';
    return {
      text,
      model: input.model ?? 'in-memory',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  }

  async completeStructured<T>(
    schema: ZodType<T>,
    input: CompleteInput,
  ): Promise<StructuredResult<T>> {
    this.calls.push(input);
    const data = schema.parse(this.structuredQueue.shift() ?? {});
    return { data, raw: JSON.stringify(data), model: input.model ?? 'in-memory' };
  }

  async embed(texts: string[], model = 'in-memory-embed'): Promise<EmbedResult> {
    return { vectors: texts.map((t) => [t.length, 0, 1]), model };
  }
}
