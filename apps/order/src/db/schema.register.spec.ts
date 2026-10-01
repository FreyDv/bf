import { PgSchema } from 'drizzle-orm/pg-core';

import * as register from './schema.register';

describe('schema.register', () => {
  it('does not export a PgSchema instance (one database per service, public schema only)', () => {
    for (const [name, value] of Object.entries(register)) {
      expect({ name, isPgSchema: value instanceof PgSchema }).toEqual({ name, isPgSchema: false });
    }
  });

  it('instantiates outbox and inbox tables', () => {
    expect(register.outbox).toBeDefined();
    expect(register.processedEvents).toBeDefined();
  });
});
