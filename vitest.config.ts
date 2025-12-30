import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
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
      // High coverage gate - 100% for functions, 99% for lines/statements, 96% for branches
      // (defensive code branches like ternary fallbacks are not practically testable)
      thresholds: {
        lines: 99,
        functions: 100,
        branches: 96,
        statements: 99,
      },
      all: true,
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
