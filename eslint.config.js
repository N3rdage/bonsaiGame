// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Agent worktrees live under .claude/ (git-ignored); linting them runs ESLint out of heap.
    ignores: [
      'archive/**',
      'blog/**',
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Plain JavaScript: the root configs and the art generators (Node
    // scripts, not in any tsconfig project) get @eslint/js recommended and
    // the global browser+node globals, without the type-checked rules.
    files: ['**/*.js', 'art/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
