import { AggregateRoot } from './aggregate-root';
import { createDomainEvent } from './domain-event';

class Counter extends AggregateRoot {
  private constructor(id: string) {
    super(id);
  }
  static create(id: string): Counter {
    const c = new Counter(id);
    c.raise(
      createDomainEvent({
        type: 'test.counter.created',
        aggregateType: 'Counter',
        aggregateId: id,
        payload: {},
      }),
    );
    return c;
  }
}

describe('AggregateRoot', () => {
  it('records and pulls domain events once', () => {
    const c = Counter.create('c1');
    expect(c.hasPendingEvents).toBe(true);
    const events = c.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('test.counter.created');
    expect(events[0]?.id).toMatch(/[0-9a-f-]{36}/);
    expect(c.pullDomainEvents()).toHaveLength(0);
  });

  it('rejects malformed event types', () => {
    expect(() =>
      createDomainEvent({ type: 'Bad', aggregateType: 'X', aggregateId: '1', payload: {} }),
    ).toThrow(/Invalid event type/);
  });
});
