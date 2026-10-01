import { z } from 'zod';

import { InMemoryLlm } from './in-memory.llm';

describe('InMemoryLlm', () => {
  it('returns scripted structured output validated by zod', async () => {
    const llm = new InMemoryLlm().enqueueStructured({ sentiment: 'positive', score: 0.9 });
    const schema = z.object({ sentiment: z.enum(['positive', 'negative']), score: z.number() });
    const res = await llm.completeStructured(schema, {
      messages: [{ role: 'user', content: 'great' }],
    });
    expect(res.data.sentiment).toBe('positive');
    expect(llm.calls).toHaveLength(1);
  });
});
