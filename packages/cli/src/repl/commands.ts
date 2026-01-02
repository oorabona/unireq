/**
 * REPL command registry and built-in commands
 */

import { consola } from 'consola';
import { createAuthCommand } from '../auth/commands.js';
import {
  createExtractCommand,
  createHistoryCommand,
  createRunCommand,
  createSaveCommand,
  createVarsCommand,
} from '../collections/commands.js';
import { VERSION } from '../index.js';
import { createSecretCommand } from '../secrets/commands.js';
import { createProfileCommand } from '../workspace/profiles/commands.js';
import { createDescribeCommand } from './describe.js';
import { CATEGORY_INFO, formatKeyboardHelp, getCommandMeta, getCommandsByCategory } from './help.js';
import { createHttpCommands } from './http-commands.js';
import { createNavigationCommands } from './navigation.js';
import type { ReplState } from './state.js';
import type { Command, CommandHandler, ParsedInput } from './types.js';

/**
 * Command registry - manages available commands
 */
export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  /**
   * Get a command by name
   */
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute a command by name
   * @throws Error if command not found
   */
  async execute(name: string, args: string[], state: ReplState): Promise<void> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Unknown command: ${name}. Type 'help' for available commands.`);
    }
    await command.handler(args, state);
  }
}

/**
 * Parse user input into command and arguments
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: [] };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0] || '';
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Built-in help command handler
 * Supports both 'help' (list all) and 'help <command>' (detailed help)
 */
export function createHelpHandler(registry: CommandRegistry): CommandHandler {
  return async (args) => {
    // If a command name is provided, show detailed help for that command
    if (args.length > 0) {
      const cmdName = args[0];
      if (!cmdName) {
        consola.info('Usage: help [command]');
        return;
      }

      // First check shared help metadata
      const meta = getCommandMeta(cmdName);
      if (meta?.helpText) {
        consola.log(meta.helpText);
        return;
      }

      // Fall back to registry command help
      const cmd = registry.get(cmdName);
      if (!cmd) {
        consola.error(`Unknown command: ${cmdName}`);
        consola.info("Type 'help' for available commands.");
        return;
      }

      // Show detailed help if available
      if (cmd.helpText) {
        consola.log(cmd.helpText);
      } else {
        consola.info(`${cmd.name}: ${cmd.description}`);
        consola.log('No detailed help available for this command.');
      }
      return;
    }

    // No args - show category-grouped list of all commands
    const grouped = getCommandsByCategory();

    // Sort categories by order
    const sortedCategories = [...grouped.entries()].sort(([a], [b]) => CATEGORY_INFO[a].order - CATEGORY_INFO[b].order);

    for (const [category, commands] of sortedCategories) {
      consola.log('');
      consola.info(`${CATEGORY_INFO[category].label}:`);
      for (const cmd of commands) {
        consola.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
      }
    }

    consola.log(formatKeyboardHelp());
    consola.log('');
    consola.info("Type 'help <command>' for detailed options.");
  };
}

/**
 * Built-in exit command handler
 */
export const exitHandler: CommandHandler = async (_args, state) => {
  state.running = false;
};

/**
 * Built-in version command handler
 */
export const versionHandler: CommandHandler = async () => {
  consola.info(`@unireq/cli v${VERSION}`);
};

/**
 * Create a registry with built-in commands
 */
export function createDefaultRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // Register help command (needs registry reference)
  registry.register({
    name: 'help',
    description: 'Show available commands or detailed help for a command',
    handler: createHelpHandler(registry),
    helpText: `Usage: help [command]

Show available commands, or detailed help for a specific command.

Examples:
  help         Show list of all commands
  help get     Show detailed options for GET command
  help post    Show detailed options for POST command`,
  });

  // Register exit command
  registry.register({
    name: 'exit',
    description: 'Exit the REPL',
    handler: exitHandler,
  });

  // Register version command
  registry.register({
    name: 'version',
    description: 'Show CLI version',
    handler: versionHandler,
  });

  // Register HTTP method commands
  for (const command of createHttpCommands()) {
    registry.register(command);
  }

  // Register navigation commands (cd, ls, pwd)
  for (const command of createNavigationCommands()) {
    registry.register(command);
  }

  // Register describe command
  registry.register(createDescribeCommand());

  // Register profile command
  registry.register(createProfileCommand());

  // Register secret command
  registry.register(createSecretCommand());

  // Register auth command
  registry.register(createAuthCommand());

  // Register collections commands
  registry.register(createRunCommand());
  registry.register(createSaveCommand());
  registry.register(createExtractCommand());
  registry.register(createVarsCommand());
  registry.register(createHistoryCommand());

  return registry;
}
