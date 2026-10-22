import { Inject } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { Input, Mutation, Query, Router, UseMiddlewares } from 'nestjs-trpc';

import {
  boundsInputSchema,
  boundsOutputSchema,
  cooldownInputSchema,
  cooldownOutputSchema,
  serviceActionOutputSchema,
  serviceNameInputSchema,
  servicesListOutputSchema,
  wakeAllOutputSchema,
} from '@bf/contracts/api';
import { AdminMiddleware } from '@bf/trpc';

import { ORCHESTRATOR } from './orchestrator';

import type { Orchestrator } from './orchestrator';
import type { ServiceActionOutput, ServiceView } from '@bf/contracts/api';
import type { z } from 'zod';

/**
 * Runtime control of the orchestrated services (role `admin`): who is awake and how big, wake/sleep by hand,
 * idle lifetime, scale bounds, forced redeploy. `/_services/trpc/services.*`.
 */
@Router({ alias: 'services' })
@UseMiddlewares(AdminMiddleware)
export class ServicesRouter {
  constructor(@Inject(ORCHESTRATOR) private readonly orchestrator: Orchestrator) {}

  @Query({ output: servicesListOutputSchema })
  list(): Promise<ServiceView[]> {
    return this.orchestrator.list();
  }

  @Mutation({ input: serviceNameInputSchema, output: serviceActionOutputSchema })
  async wake(
    @Input() { name }: z.infer<typeof serviceNameInputSchema>,
  ): Promise<ServiceActionOutput> {
    this.check(name);
    await this.orchestrator.wake(name);
    return { service: name, action: 'wake', at: new Date().toISOString() };
  }

  @Mutation({ output: wakeAllOutputSchema })
  async wakeAll(): Promise<z.infer<typeof wakeAllOutputSchema>> {
    await this.orchestrator.wakeAll();
    return { action: 'wake-all', at: new Date().toISOString() };
  }

  @Mutation({ input: serviceNameInputSchema, output: serviceActionOutputSchema })
  async sleep(
    @Input() { name }: z.infer<typeof serviceNameInputSchema>,
  ): Promise<ServiceActionOutput> {
    this.check(name);
    await this.orchestrator.sleep(name);
    return { service: name, action: 'sleep', at: new Date().toISOString() };
  }

  @Mutation({ input: serviceNameInputSchema, output: serviceActionOutputSchema })
  async redeploy(
    @Input() { name }: z.infer<typeof serviceNameInputSchema>,
  ): Promise<ServiceActionOutput> {
    this.check(name);
    await this.orchestrator.redeploy(name);
    return { service: name, action: 'redeploy', at: new Date().toISOString() };
  }

  @Mutation({ input: cooldownInputSchema, output: cooldownOutputSchema })
  async cooldown(
    @Input() { name, seconds }: z.infer<typeof cooldownInputSchema>,
  ): Promise<z.infer<typeof cooldownOutputSchema>> {
    this.check(name);
    await this.orchestrator.setCooldown(name, seconds);
    return { service: name, cooldownS: seconds };
  }

  @Mutation({ input: boundsInputSchema, output: boundsOutputSchema })
  async bounds(
    @Input() { name, min, max }: z.infer<typeof boundsInputSchema>,
  ): Promise<z.infer<typeof boundsOutputSchema>> {
    this.check(name);
    await this.orchestrator.setBounds(name, min, max);
    return { service: name, bounds: { min, max } };
  }

  private check(name: string) {
    if (!this.orchestrator.has(name))
      throw new TRPCError({ code: 'NOT_FOUND', message: `unknown service ${name}` });
  }
}
