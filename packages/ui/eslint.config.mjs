import { react } from '@bf/config/eslint';

/** shadcn-generated components lean on `any` in recharts typings; relax the unsafe-* family here only. */
export default [
  ...react,
  {
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // shadcn sidebar/use-mobile sync state from media queries inside effects by design
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
