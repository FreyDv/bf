import { base } from '@bf/config/eslint';

export default [
  { ignores: ['src/generated/**'] },
  ...base({ tsconfigRootDir: import.meta.dirname }),
];
