// The name of a test schema is needed when the tables are defined, before a test connects, so this fixture module
// cannot import @bf/test-db (only test files may). The helper accepts any `<prefix>_<8 hex>` name.
import { randomBytes } from 'node:crypto';

export const newSchemaName = (): string => `qf_${randomBytes(4).toString('hex')}`;
