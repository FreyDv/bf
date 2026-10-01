/* Manual smoke test: OPENAI_API_KEY=... pnpm --filter @bf/llm smoke */
import { z } from 'zod';

import { llmEnvSchema, llmOptionsFromEnv } from '../src/env';
import { OpenAiLlm } from '../src/openai.llm';

async function main() {
  const llm = new OpenAiLlm(llmOptionsFromEnv(llmEnvSchema.parse(process.env)));
  const text = await llm.complete({
    system: 'Answer in one word.',
    messages: [{ role: 'user', content: 'Capital of France?' }],
    tag: 'smoke',
  });
  console.log('complete:', text);
  const structured = await llm.completeStructured(
    z.object({ city: z.string(), country: z.string() }),
    {
      messages: [{ role: 'user', content: 'Give the capital of Japan as JSON.' }],
      schemaName: 'capital',
    },
  );
  console.log('structured:', structured.data);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
