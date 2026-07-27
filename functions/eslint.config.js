const tseslint = require('typescript-eslint');

/**
 * The rule that matters here is the last block: `src/receipts/core/**` may not import Firebase, the
 * Vision SDK, or any sibling I/O layer.
 *
 * That purity is design decision D3 in docs/ocr-receipt-validation-plan.md, and it buys three things:
 * the client cannot forge fields, parser fixes deploy without an app-store release, and the tests are
 * hermetic. A comment saying "keep this pure" would rot within a month; this fails the build.
 *
 * Type-only imports are banned too (allowTypeImports is left at its default of false). The core defines
 * its own structural Vision types — the real SDK response is structurally assignable to them — so the
 * core stays dependency-free and fixtures stay trivial to write.
 */
module.exports = tseslint.config(
  {
    ignores: ['lib/**', 'node_modules/**', 'coverage/**', 'jest.config.js', 'eslint.config.js'],
  },

  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { project: './tsconfig.test.json', tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },

  {
    files: ['__tests__/**/*.ts', 'scripts/**/*.ts', '__fixtures__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    files: ['src/receipts/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'firebase-admin',
                'firebase-admin/*',
                'firebase-functions',
                'firebase-functions/*',
                '@google-cloud/*',
                'firebase',
                'firebase/*',
              ],
              message:
                'core/ must stay pure (design decision D3). Vision JSON in, plain result object out — no Firebase, no SDKs, no I/O.',
            },
            {
              group: ['**/vision/**', '**/data/**', '../../*', '../../../*'],
              message:
                'core/ must not reach into sibling I/O layers. Dependencies point INTO core, never out of it.',
            },
          ],
        },
      ],
    },
  },
);
