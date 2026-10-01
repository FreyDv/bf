import tseslint from 'typescript-eslint';

import { base } from './base.mjs';

/** NestJS preset: decorators + DI-friendly rules on top of `base`. */
export const nest = tseslint.config(...base, {
  rules: {
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
  },
});

export default nest;
