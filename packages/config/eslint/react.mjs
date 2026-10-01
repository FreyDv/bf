import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { base } from './base.mjs';

/** React / Next.js preset (ESLint 10): @eslint-react (type-aware) + react-hooks. */
export const reactPreset = tseslint.config(...base, {
  files: ['**/*.{ts,tsx}'],
  ...eslintReact.configs['recommended-typescript'],
  plugins: { ...eslintReact.configs['recommended-typescript'].plugins, 'react-hooks': reactHooks },
  languageOptions: {
    globals: { ...globals.browser },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    ...eslintReact.configs['recommended-typescript'].rules,
    ...reactHooks.configs['recommended-latest'].rules,
  },
});

export default reactPreset;
