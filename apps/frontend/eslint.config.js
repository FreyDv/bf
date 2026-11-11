import { next } from '@bf/config/eslint';

export default await next({ tsconfigRootDir: import.meta.dirname });
