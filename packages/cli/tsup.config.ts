import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library entry
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    splitting: false,
    minify: true,
    target: 'es2022',
  },
  // CLI binary entry (with shebang)
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: true,
    clean: false, // Don't clean - index.js already there
    sourcemap: true,
    treeshake: true,
    splitting: false,
    minify: true,
    target: 'es2022',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
