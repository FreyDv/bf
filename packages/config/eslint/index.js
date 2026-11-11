import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const ignores = { ignores: ['dist/**', '.next/**', 'coverage/**', 'next-env.d.ts'] };

/** Type-aware base (ADR-016). The consumer passes the directory holding its tsconfig. */
export function base({ tsconfigRootDir }) {
  return tseslint.config(
    ignores,
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
    },
    { files: ['**/*.js', '**/*.mjs'], ...tseslint.configs.disableTypeChecked },
    prettier,
  );
}

/** Nest: decorators and DI make `import type` impossible for injected classes. */
export function nest({ tsconfigRootDir }) {
  return tseslint.config(...base({ tsconfigRootDir }), {
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  });
}

export async function next({ tsconfigRootDir }) {
  const { default: vitals } = await import('eslint-config-next/core-web-vitals');
  return tseslint.config(...vitals, ...base({ tsconfigRootDir }));
}
