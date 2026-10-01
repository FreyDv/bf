import { z } from 'zod';

import { llmEnvSchema } from '@bf/llm';
import { baseEnvSchema } from '@bf/server';

/** ai env = base + OpenAI (key optional: `ai.ask` answers 503 until it is set). */
export const envSchema = baseEnvSchema
  .merge(llmEnvSchema.partial({ OPENAI_API_KEY: true }))
  .extend({
    SERVICE_NAME: z.string().default('ai'),
    PORT: z.coerce.number().int().default(3006),
    OPENAI_API_KEY: z
      .string()
      .optional()
      .transform((v) => v || undefined),
  });

export type Env = z.infer<typeof envSchema>;
