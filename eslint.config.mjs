import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = Object.fromEntries(['process', 'console', 'URL', 'setTimeout'].map((g) => [g, 'readonly']));
// The e2e script runs callbacks inside the browser/extension via page.evaluate.
const browserGlobals = Object.fromEntries(['chrome', 'document', 'indexedDB'].map((g) => [g, 'readonly']));

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: { ...nodeGlobals, ...browserGlobals } } },
);
