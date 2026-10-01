import { Input, Query, Router } from 'nestjs-trpc';

import { pingInputSchema, pingOutputSchema } from '@bf/contracts/common';

import type { PingOutput } from '@bf/contracts/common';
import type { z } from 'zod';

const SERVICE = 'course';

@Router({ alias: 'health' })
export class HealthRouter {
  @Query({ input: pingInputSchema, output: pingOutputSchema })
  ping(@Input() input: z.infer<typeof pingInputSchema>): PingOutput {
    return { service: SERVICE, ok: true, echo: input?.echo, at: new Date().toISOString() };
  }
}
