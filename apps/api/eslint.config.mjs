// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/uploadthing/upload-router.ts'],
    rules: {
      '@typescript-eslint/only-throw-error': ['error', { allow: ['UploadThingError'] }],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      /**
       * Disable the base rule. `@typescript-eslint/only-throw-error`       * (enabled via recommendedTypeChecked) is type-aware and correctly
       * recognizes `UploadThingError` (which extends `Micro.Error`) as an
       * error object, unlike the base rule which only does static analysis.
       */
      'no-throw-literal': 'off',
    },
  },
);
