import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        crypto: 'readonly',
        FileReader: 'readonly',
        FileList: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLCanvasElement: 'readonly',
        Image: 'readonly',
        devicePixelRatio: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        structuredClone: 'readonly',
        TextEncoder: 'readonly',
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        React: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly'
      }
    }
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': hooks
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
