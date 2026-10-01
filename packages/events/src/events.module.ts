import { Global, Inject, Module } from '@nestjs/common';

import { EVENT_PUBLISHER, OutboxEventPublisher } from './publisher';

import type { OutboxTable } from './tables';
import type { DynamicModule } from '@nestjs/common';

export interface EventsModuleOptions {
  /** Producing service name written into every envelope (`source`). */
  source: string;
  outbox: OutboxTable;
}

/** Provides EVENT_PUBLISHER (outbox-backed). */
@Global()
@Module({})
export class EventsModule {
  static forRoot(options: EventsModuleOptions): DynamicModule {
    return {
      module: EventsModule,
      providers: [
        {
          provide: EVENT_PUBLISHER,
          useValue: new OutboxEventPublisher(options.outbox, options.source),
        },
      ],
      exports: [EVENT_PUBLISHER],
    };
  }
}

export const InjectEventPublisher = () => Inject(EVENT_PUBLISHER);
