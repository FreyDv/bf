import { Inject, Injectable, Logger } from '@nestjs/common';

import { ORCHESTRATOR } from './orchestrator';

import type { Orchestrator } from './orchestrator';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export const SWEEP_INTERVAL_MS = 60_000;
export const SWEEP_JITTER_MS = 30_000;

/**
 * Runs the idle sweep once a minute in every api task (with a random offset so tasks do not all call ECS in
 * the same second). Plain timers, unref'd: nothing keeps the process alive and tests can use fake timers.
 */
@Injectable()
export class SweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SweepService.name);
  private timer?: NodeJS.Timeout;
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(ORCHESTRATOR) private readonly orchestrator: Orchestrator) {}

  onModuleInit(): void {
    if (!this.orchestrator.enabled) return;
    const jitter = Math.floor(Math.random() * SWEEP_JITTER_MS);
    this.timer = setTimeout(() => {
      void this.run();
      this.interval = setInterval(() => void this.run(), SWEEP_INTERVAL_MS);
      this.interval.unref();
    }, jitter);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
  }

  /** One sweep; overlapping runs are skipped, errors are logged and never thrown. */
  async run(): Promise<void> {
    if (!this.orchestrator.enabled || this.running) return;
    this.running = true;
    try {
      await this.orchestrator.sweep();
    } catch (error) {
      this.logger.warn(`sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
