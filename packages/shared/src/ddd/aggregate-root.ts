import { Entity } from './entity';

import type { DomainEvent } from './domain-event';

/**
 * Aggregate root that records domain events. Events are pulled by the
 * application layer and handed to the outbox publisher in the same transaction.
 */
export abstract class AggregateRoot<Id extends string = string> extends Entity<Id> {
  #events: DomainEvent[] = [];
  #version = 0;

  get version(): number {
    return this.#version;
  }

  protected setVersion(v: number): void {
    this.#version = v;
  }

  protected raise(event: DomainEvent): void {
    this.#events.push(event);
  }

  /** Returns and clears the recorded events. */
  pullDomainEvents(): DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  get hasPendingEvents(): boolean {
    return this.#events.length > 0;
  }
}
