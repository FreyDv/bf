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
    // Domain-Driven Hexagon (docs/standards/domain-driven-hexagon/rules.md, DDH-29/DDH-128):
    // state changes go through intention-revealing methods, never property setters; labels
    // and `with` are banned as in the reference's .eslintrc.
    'no-restricted-syntax': [
      'error',
      {
        selector: 'LabeledStatement',
        message:
          'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message:
          '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
      {
        selector: "MethodDefinition[kind='set']",
        message:
          'Property setters are not allowed: change state through an intention-revealing method (DDH-29).',
      },
    ],
  },
});

export default nest;
