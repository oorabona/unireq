import { defineConfig } from 'tsup';

// Native modules that cannot be bundled - must be resolved at runtime
const nativeModules = ['@napi-rs/keyring', '@node-rs/argon2'];

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
    external: nativeModules,
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
    external: nativeModules,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
