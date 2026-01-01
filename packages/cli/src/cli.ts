/**
 * CLI entry point for @unireq/cli
 *
 * This file is the binary entry point (bin/unireq).
 * Shebang is added by tsup during build.
 */

import { runMain } from 'citty';
import { consola } from 'consola';
import { mainCommand } from './commands/main.js';

/**
 * Configure consola for CLI usage
 * Force log level to 3 (log/info) regardless of TTY status
 * This ensures output is visible when running as subprocess
 */
consola.level = 3;

/**
 * Run the CLI
 */
runMain(mainCommand);
