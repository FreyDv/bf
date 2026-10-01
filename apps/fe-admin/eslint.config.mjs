import { react } from '@bf/config/eslint';

export default [
  ...react,
  { ignores: ['.next/**', 'next-env.d.ts'] },
  // Next's tsconfig already includes every *.ts file, so no default project is needed here.
  { files: ['**/*.{ts,tsx,mts}'], languageOptions: { parserOptions: { projectService: true } } },
];
