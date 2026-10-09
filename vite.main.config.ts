import path from 'node:path';

import { defineConfig } from 'vite';

/**
 * Main process build.
 * Aliases mirror `tsconfig.json` so main/preload/renderer can share `src/shared`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  build: {
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['electron', 'electron-squirrel-startup'],
    },
  },
});
