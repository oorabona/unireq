/**
 * REPL command registry and built-in commands
 */

import { consola } from 'consola';
import { VERSION } from '../index.js';
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
 */
export function createHelpHandler(registry: CommandRegistry): CommandHandler {
  return async () => {
    consola.info('Available commands:');
    const commands = registry.getAll();
    for (const cmd of commands) {
      consola.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    }
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
    description: 'Show available commands',
    handler: createHelpHandler(registry),
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

  return registry;
}
