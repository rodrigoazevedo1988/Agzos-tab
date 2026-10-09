import path from 'node:path';

import { defineConfig } from 'vite';

/** Preload script build. Must stay small and dependency-free apart from shared types. */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
  build: {
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['electron'],
    },
  },
});
