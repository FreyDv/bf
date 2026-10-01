import { z } from 'zod';

export const llmEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
});

export type LlmEnv = z.infer<typeof llmEnvSchema>;

export interface LlmOptions {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  model: string;
  embeddingModel: string;
  timeoutMs: number;
  maxRetries: number;
}

export function llmOptionsFromEnv(env: LlmEnv): LlmOptions {
  return {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    organization: env.OPENAI_ORG_ID,
    model: env.OPENAI_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    maxRetries: env.OPENAI_MAX_RETRIES,
  };
}
