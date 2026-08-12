import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run the TypeScript sources. Without this, once `npm run build` has
    // produced dist/, vitest also collects the compiled dist/**/*.test.js copies
    // — which fail with "Vitest cannot be imported in a CommonJS module",
    // reporting failures that don't correspond to any real broken test.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
