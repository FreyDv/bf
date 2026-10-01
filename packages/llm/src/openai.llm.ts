import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import type { LlmOptions } from './env';
import type {
  CompleteInput,
  CompleteResult,
  EmbedResult,
  LlmMessage,
  LlmPort,
  StructuredResult,
} from './port';
import type { ZodType } from 'zod';

export class LlmError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** OpenAI GPT API adapter. SDK handles retries with exponential backoff; we add timeouts. */
export class OpenAiLlm implements LlmPort {
  readonly client: OpenAI;

  constructor(
    private readonly options: LlmOptions,
    client?: OpenAI,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        organization: options.organization,
        timeout: options.timeoutMs,
        maxRetries: options.maxRetries,
      });
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    const model = input.model ?? this.options.model;
    return this.timed('complete', async () => {
      const res = await this.client.chat.completions.create(
        {
          model,
          messages: toMessages(input),
          temperature: input.temperature,
          max_tokens: input.maxTokens,
        },
        { timeout: input.timeoutMs },
      );
      const choice = res.choices[0];
      return {
        text: choice?.message?.content ?? '',
        model: res.model,
        finishReason: choice?.finish_reason,
        usage: usage(res.usage),
      };
    });
  }

  async completeStructured<T>(
    schema: ZodType<T>,
    input: CompleteInput & { schemaName?: string },
  ): Promise<StructuredResult<T>> {
    const model = input.model ?? this.options.model;
    return this.timed('structured', async () => {
      const res = await this.client.chat.completions.parse(
        {
          model,
          messages: toMessages(input),
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          response_format: zodResponseFormat(schema, input.schemaName ?? 'result'),
        },
        { timeout: input.timeoutMs },
      );
      const choice = res.choices[0];
      if (choice?.message?.refusal) throw new LlmError(`Model refused: ${choice.message.refusal}`);
      const raw = choice?.message?.content ?? '';
      const parsed = choice?.message?.parsed ?? schema.parse(JSON.parse(raw));
      return {
        data: parsed,
        raw,
        model: res.model,
        finishReason: choice?.finish_reason,
        usage: usage(res.usage),
      };
    });
  }

  async embed(texts: string[], model = this.options.embeddingModel): Promise<EmbedResult> {
    return this.timed('embed', async () => {
      const res = await this.client.embeddings.create({ model, input: texts });
      return {
        vectors: res.data.map((d) => d.embedding),
        model: res.model,
        usage: res.usage
          ? { promptTokens: res.usage.prompt_tokens, totalTokens: res.usage.total_tokens }
          : undefined,
      };
    });
  }

  private async timed<R>(op: string, fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof LlmError) throw e;
      const status = (e as { status?: number }).status;
      throw new LlmError(`OpenAI ${op} failed: ${(e as Error).message}`, e, status);
    }
  }
}

function toMessages(input: CompleteInput): LlmMessage[] {
  return input.system
    ? [{ role: 'system', content: input.system }, ...input.messages]
    : input.messages;
}

function usage(
  u?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null,
) {
  return u
    ? {
        promptTokens: u.prompt_tokens,
        completionTokens: u.completion_tokens,
        totalTokens: u.total_tokens,
      }
    : undefined;
}
