/**
 * CLI entry point for @unireq/cli
 *
 * This file is the binary entry point (bin/unireq).
 * Shebang is added by tsup during build.
 */

import { VERSION } from './index.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --version / -V
  if (args.includes('--version') || args.includes('-V')) {
    console.log(`unireq v${VERSION}`);
    process.exit(0);
  }

  // Handle --help / -h
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(
      `
unireq v${VERSION} - HTTP CLI client with REPL mode

Usage:
  unireq [options]
  unireq <command> [options]

Options:
  -h, --help     Show this help message
  -V, --version  Show version number

Commands:
  (coming soon)

For more information, visit: https://github.com/oorabona/unireq
`.trim(),
    );
    process.exit(0);
  }

  // Placeholder for future command handling
  console.error(`Unknown command: ${args[0]}`);
  console.error('Run "unireq --help" for usage information.');
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
