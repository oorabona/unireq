/**
 * CLI entry point for @unireq/cli
 *
 * This file is the binary entry point (bin/unireq).
 * Shebang is added by tsup during build.
 */

import { runMain } from 'citty';
import { mainCommand } from './commands/main.js';

/**
 * Run the CLI
 */
runMain(mainCommand);
