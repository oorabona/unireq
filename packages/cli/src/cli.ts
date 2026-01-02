/**
 * CLI entry point for @unireq/cli
 *
 * This file is the binary entry point (bin/unireq).
 * Shebang is added by tsup during build.
 */

import { runMain } from 'citty';
import { consola } from 'consola';
import { mainCommand } from './commands/main.js';
import { getCommandMeta } from './repl/help.js';

/**
 * Configure consola for CLI usage
 * Force log level to 3 (log/info) regardless of TTY status
 * This ensures output is visible when running as subprocess
 */
consola.level = 3;

/**
 * HTTP subcommands that should use unified help
 */
const HTTP_SUBCOMMANDS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/**
 * Intercept --help for HTTP subcommands to show unified help (same as REPL)
 * This runs BEFORE citty processes the args
 */
function handleUnifiedHelp(): boolean {
  const args = process.argv.slice(2);

  // Check if this is a help request for an HTTP subcommand
  // Pattern: unireq <method> --help or unireq <method> -h
  if (args.length >= 2) {
    const subcommand = args[0]?.toLowerCase();
    const hasHelp = args.includes('--help') || args.includes('-h');

    if (subcommand && HTTP_SUBCOMMANDS.includes(subcommand) && hasHelp) {
      const meta = getCommandMeta(subcommand);
      if (meta?.helpText) {
        consola.log(meta.helpText);
        return true;
      }
    }
  }

  return false;
}

// Handle unified help before citty
if (handleUnifiedHelp()) {
  process.exit(0);
}

/**
 * Run the CLI
 */
runMain(mainCommand);
