import { bootstrapApp } from '@bf/server';

import { AppModule } from './app/app.module';

/** LLM facade over OpenAI (@bf/llm). tRPC at /trpc. */
void bootstrapApp(AppModule);
