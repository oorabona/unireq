/**
 * REPL engine - main interactive loop using Node.js repl module
 *
 * Features:
 * - Tab completion for commands and paths
 * - History navigation with arrow keys
 * - Ctrl+R for reverse history search
 * - Multiline JSON input support
 * - History persistence across sessions
 */

import * as nodeRepl from 'node:repl';
import { consola } from 'consola';
import { HistoryWriter } from '../collections/history/index.js';
import { getSpecInfoString, loadSpecIntoState } from '../openapi/state-loader.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import { getActiveProfile, getActiveWorkspace } from '../workspace/global-config.js';
import { getWorkspace } from '../workspace/registry/loader.js';
import { type CommandRegistry, createDefaultRegistry } from './commands.js';
import { createCompleter } from './completer.js';
import { createEval } from './eval.js';
import { getHistoryFilePath, InputHistory, type InputHistoryConfig } from './input-history.js';
import type { ReplState } from './state.js';
import { createReplState, formatPrompt, getHistoryPath } from './state.js';

/**
 * REPL options
 */
export interface ReplOptions {
  /** Workspace directory */
  workspace?: string;
  /** Custom command registry (for testing) */
  registry?: CommandRegistry;
  /** Custom input stream (for testing) */
  input?: NodeJS.ReadableStream;
  /** Custom output stream (for testing) */
  output?: NodeJS.WritableStream;
  /** Whether to use terminal features (colors, cursor control) */
  terminal?: boolean;
  /** Input history configuration */
  historyConfig?: InputHistoryConfig;
}

/**
 * Setup readline history from InputHistory
 * Node.js REPL uses setupHistory for persistence, but we manage our own
 */
function setupReplHistory(replServer: nodeRepl.REPLServer, inputHistory: InputHistory): void {
  // Load existing history into readline
  // The history property exists at runtime but is not in the type definitions
  const history = (replServer as nodeRepl.REPLServer & { history: string[] }).history;
  const entries = inputHistory.getAll();
  // Add entries in reverse order (oldest first) so newest is at the end
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry) {
      history.push(entry);
    }
  }

  // Hook into line event to save history
  replServer.on('line', (line: string) => {
    const trimmed = line.trim();
    if (trimmed) {
      inputHistory.add(trimmed);
      inputHistory.save();
    }
  });
}

/**
 * Update prompt dynamically based on state changes
 */
function updatePrompt(replServer: nodeRepl.REPLServer, state: ReplState): void {
  replServer.setPrompt(formatPrompt(state));
}

/**
 * Run the interactive REPL loop
 */
export async function runRepl(options?: ReplOptions): Promise<void> {
  // Create history writer for HTTP request/command logging (ndjson)
  const historyPath = getHistoryPath(options?.workspace);
  const historyWriter = historyPath ? new HistoryWriter({ historyPath }) : undefined;

  const state = createReplState({ workspace: options?.workspace, historyWriter });
  // Mark as REPL mode - commands should not use @clack/prompts (terminal conflict)
  state.isReplMode = true;
  const registry = options?.registry ?? createDefaultRegistry();

  // Load active workspace config into state
  const activeWorkspaceName = getActiveWorkspace();
  if (activeWorkspaceName) {
    const ws = getWorkspace(activeWorkspaceName);
    if (ws) {
      const config = loadWorkspaceConfig(ws.path);
      if (config) {
        state.workspace = ws.path;
        state.workspaceConfig = config;
        state.activeProfile = getActiveProfile();

        // Auto-load OpenAPI spec if configured
        if (config.openapi?.source) {
          await loadSpecIntoState(state, config.openapi.source, {
            workspacePath: ws.path,
            silent: true, // We'll show info in welcome message
          });
        }
      }
    }
  }

  // Create input history for readline (arrow key navigation, Ctrl+R)
  // Constructor auto-loads from historyPath if available
  const inputHistoryPath = getHistoryFilePath(options?.workspace);
  const inputHistory = new InputHistory({
    maxEntries: options?.historyConfig?.maxEntries ?? 1000,
    historyPath: options?.historyConfig?.historyPath ?? inputHistoryPath ?? undefined,
  });

  // Create completer for tab completion
  const completer = createCompleter(state, registry);

  // Create custom eval function
  const evalFn = createEval(registry, state);

  // Welcome message
  console.log('');
  consola.info('╔════════════════════════════╗');
  consola.info('║  Welcome to unireq REPL    ║');
  consola.info('╚════════════════════════════╝');

  if (state.workspaceConfig) {
    const workspaceLabel = activeWorkspaceName === '(local)' ? 'local' : activeWorkspaceName;
    const profileLabel = state.activeProfile ? ` / ${state.activeProfile}` : '';
    consola.info(`Workspace: ${workspaceLabel}${profileLabel}`);
  }

  // Show OpenAPI spec info if loaded
  const specInfo = getSpecInfoString(state);
  if (specInfo) {
    consola.info(`OpenAPI: ${specInfo}`);
  }

  consola.info("Type 'help' for available commands, 'exit' or Ctrl+D to quit.");
  consola.info('Tab for completion, Ctrl+R for history search.');
  console.log(''); // Empty line before prompt

  // Create the REPL server
  const replServer = nodeRepl.start({
    prompt: formatPrompt(state),
    eval: evalFn,
    completer: completer,
    input: options?.input ?? process.stdin,
    output: options?.output ?? process.stdout,
    terminal: options?.terminal ?? process.stdout.isTTY ?? true,
    useColors: true,
    ignoreUndefined: true,
    preview: false, // Disable preview to avoid interference with our eval
  });

  // Setup history
  setupReplHistory(replServer, inputHistory);

  // Store reference to replServer in state for prompt updates
  (state as ReplState & { replServer?: nodeRepl.REPLServer }).replServer = replServer;

  // Listen for state changes that affect prompt
  // Use a proxy or interval to detect currentPath changes
  let lastPath = state.currentPath;
  const promptUpdateInterval = setInterval(() => {
    if (state.currentPath !== lastPath) {
      lastPath = state.currentPath;
      updatePrompt(replServer, state);
      replServer.displayPrompt();
    }
  }, 100);

  // Handle exit command setting state.running = false
  const runningCheckInterval = setInterval(() => {
    if (!state.running) {
      clearInterval(runningCheckInterval);
      clearInterval(promptUpdateInterval);
      replServer.close();
    }
  }, 100);

  // Handle REPL close (Ctrl+D or exit command)
  return new Promise<void>((resolve) => {
    replServer.on('close', () => {
      clearInterval(runningCheckInterval);
      clearInterval(promptUpdateInterval);
      console.log(''); // New line after prompt
      consola.info('Goodbye!');
      resolve();
    });

    // Handle SIGINT (Ctrl+C) - just clear line, don't exit
    replServer.on('SIGINT', () => {
      // If there's input, clear it; otherwise do nothing
      // The default behavior handles this well
    });
  });
}
