/**
 * REPL module exports
 *
 * Note: The REPL uses Ink UI only (no legacy Node.js REPL fallback).
 * Use runInkRepl() from '../ui/index.js' to start the REPL.
 */

export { CommandRegistry, createDefaultRegistry, parseInput } from './commands.js';
export {
  CATEGORY_INFO,
  type CommandCategory,
  type CommandMeta,
  formatKeyboardHelp,
  formatShellHelp,
  getCommandMeta,
  getCommandsByCategory,
  REPL_COMMANDS,
} from './help.js';
export { createHttpCommands, createHttpHandler } from './http-commands.js';
export { getSupportedMethods, isHttpMethod, parseHttpCommand } from './http-parser.js';
export { getHistoryFilePath, InputHistory, type InputHistoryConfig } from './input-history.js';
export { cdHandler, createNavigationCommands, lsHandler, pwdHandler } from './navigation.js';
export { normalizePath, resolvePath } from './path-utils.js';
export { createReplState, formatPrompt, getHistoryPath, type ReplState } from './state.js';
export type { Command, CommandHandler, ParsedInput } from './types.js';
export {
  buildDisplayUrl,
  isExplicitUrl,
  normalizeUrl,
  type ResolvedUrl,
  resolveUrl,
  type UrlResolutionContext,
  UrlResolutionError,
} from './url-resolver.js';
