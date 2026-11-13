import { defineConfig } from 'vitest/config';

// Plain Vitest: the toolkit has no decorators, so the SWC preset of the Nest apps is not needed.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
