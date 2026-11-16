import { nestVitest } from '@bf/config/vitest';

// The default level would print every record of every test; a test that reads records sets its own level.
export default nestVitest({ test: { env: { LOG_LEVEL: 'silent' } } });
