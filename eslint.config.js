import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'docs/design',
      'src/types/database.types.ts', // генерується: npm run db:types
      'supabase/functions/**/!(_shared)/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // SPEC 13.7: замість спінерів — скелетони тієї ж форми (src/components/Skeletons.tsx)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mantine/core',
              importNames: ['Loader', 'LoadingOverlay'],
              message: 'Спінери заборонено (SPEC 13.7) — використовуй скелетони з src/components/Skeletons.tsx',
            },
          ],
        },
      ],
    },
  },
)
