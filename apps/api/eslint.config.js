const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-namespace': 'off', // Allow namespace for Express interface extension
    },
  },
  {
    // Relax rules for test files — `any` is acceptable in mocks/stubs
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    // Relax `any` in infrastructure and service layers where Prisma-generated types
    // frequently produce `any` (transactions, raw queries, JSON fields, dynamic selects)
    files: [
      '**/dto/**/*.ts',
      '**/interfaces/**/*.ts',
      '**/utils/**/*.ts',
      '**/filters/**/*.ts',
      '**/guards/**/*.ts',
      '**/processors/**/*.ts',
      '**/common/**/*.ts',
      '**/services/*.ts',
      '**/controllers/*.ts',
      '**/providers/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  eslintConfigPrettier,
);
