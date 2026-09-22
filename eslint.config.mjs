import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.terraform/**',
      '**/drizzle/**',
      'packages/ui/src/lib/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      'prefer-arrow-functions': preferArrowFunctions,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            'apps/admin/tsconfig.json',
            'apps/admin/tsconfig.app.json',
            'apps/client/tsconfig.json',
            'apps/client/tsconfig.app.json',
            'apps/api/tsconfig.json',
            'apps/etl/tsconfig.json',
            'packages/schemas/tsconfig.json',
            'packages/ui/tsconfig.json',
            'packages/scryfall-query/tsconfig.json',
          ],
          noWarnOnMultipleProjects: true,
        },
        node: true,
      },
    },
    rules: {
      curly: ['error', 'all'],
      'prefer-arrow-callback': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='passthrough']",
          message:
            'Zod .passthrough() is deprecated. Use z.looseObject({ ... }) to keep unknown keys.',
        },
      ],
      'prefer-arrow-functions/prefer-arrow-functions': [
        'error',
        {
          allowedNames: [],
          allowNamedFunctions: false,
          allowObjectProperties: false,
          classPropertiesAllowed: false,
          disallowPrototype: false,
          returnStyle: 'unchanged',
          singleReturnOnly: false,
        },
      ],
      // Groups (blank line between):
      // 1. Node stdlib
      // 2. Third-party (not @respark/*)
      // 3. Workspace packages (@respark/*)
      // 4. App aliases (@respark-*, @/)
      // 5. Parent
      // 6. Sibling
      // 7. Everything else (index / unknown)
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@respark/**',
              group: 'external',
              position: 'after',
            },
            {
              pattern: '@respark-*/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          // Allow pathGroups to match workspace packages (normally treated as external).
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Extensionless TS imports (Vite resolves them). Allow .js for Node16 package re-exports.
      'import/extensions': [
        'error',
        'never',
        {
          js: 'ignore',
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
  {
    files: ['apps/client/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Common in data-fetch / URL-sync effects; revisit when refactoring those flows.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['apps/api/**/*.ts', 'apps/etl/**/*.ts', 'packages/schemas/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
);
