import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    env: {
      FORCE_COLOR: '1',
    },
    exclude: ['node_modules', '**/node_modules/**', 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/*.integration.test.ts',
        '**/*.spec.ts',
        '**/tsup.config.ts',
        '**/vitest.config.ts',
        'examples',
        'scripts',
        '__integration__',
        '**/src/index.ts', // Re-export files, tested indirectly
        '**/src/types.ts', // Type-only files, no executable code
        'packages/ftp/src/**', // FTP protocol implementation requires real server
        'packages/http2/src/**', // HTTP/2 implementation requires server setup
        'packages/imap/src/**', // IMAP protocol implementation requires real server
        'packages/smtp/src/**', // SMTP protocol implementation requires real server
        '**/src/__tests__/**', // Test helpers, not production code
        'packages/presets/src/*-facade.ts', // Protocol facades require real servers
      ],
      // Per-package coverage thresholds
      // Library packages: 100% lines/statements/functions, 95% branches
      // CLI package: lower thresholds (interactive UI + defensive code)
      thresholds: {
        // Library packages - strict 100% coverage
        'packages/core/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 95,
          statements: 100,
        },
        'packages/http/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 95,
          statements: 100,
        },
        'packages/graphql/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 95,
          statements: 100,
        },
        'packages/oauth/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 95,
          statements: 100,
        },
        'packages/otel/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 90,
          statements: 100,
        },
        'packages/presets/src/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 90,
          statements: 100,
        },
        // CLI package - lower thresholds (interactive UI components)
        'packages/cli/src/**/*.ts': {
          lines: 60,
          functions: 60,
          branches: 50,
          statements: 60,
        },
      },
      all: true,
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
