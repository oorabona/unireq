/**
 * REPL session state management
 */

import { join } from 'node:path';
import type { HistoryWriter } from '../collections/history/index.js';
import type { NavigationTree } from '../openapi/navigation/types.js';
import type { LoadedSpec } from '../openapi/types.js';
import type { IVault } from '../secrets/types.js';
import type { ParsedRequest } from '../types.js';
import type { WorkspaceConfig } from '../workspace/config/types.js';
import { getGlobalWorkspacePath } from '../workspace/paths.js';

/**
 * REPL session state
 */
export interface ReplState {
  /** Current API path (default: '/') */
  currentPath: string;
  /** Workspace directory (optional) */
  workspace?: string;
  /** Whether REPL should continue running */
  running: boolean;
  /** Loaded OpenAPI spec (optional) */
  spec?: LoadedSpec;
  /** Navigation tree built from spec (optional) */
  navigationTree?: NavigationTree;
  /** Loaded workspace configuration (optional) */
  workspaceConfig?: WorkspaceConfig;
  /** Currently active profile name (runtime, may differ from config) */
  activeProfile?: string;
  /** Secrets vault (optional, created on first use) */
  vault?: IVault;
  /** Last executed HTTP request (for save command) */
  lastRequest?: ParsedRequest;
  /** Last response body (for extract command) */
  lastResponseBody?: string;
  /** Extracted variables from responses (for request chaining) */
  extractedVars?: Record<string, string>;
  /** History writer for logging commands and requests */
  historyWriter?: HistoryWriter;
}

/** Default history file name */
const HISTORY_FILE = 'history.ndjson';

/**
 * Get the path for history file based on workspace or global config
 */
export function getHistoryPath(workspace?: string): string | null {
  if (workspace) {
    // Use workspace-specific history
    return join(workspace, '.unireq', HISTORY_FILE);
  }

  // Use global workspace path
  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }

  return join(globalPath, HISTORY_FILE);
}

/**
 * Create initial REPL state
 */
export function createReplState(options?: { workspace?: string; historyWriter?: HistoryWriter }): ReplState {
  return {
    currentPath: '/',
    workspace: options?.workspace,
    running: true,
    historyWriter: options?.historyWriter,
  };
}

/**
 * Format the prompt string based on current state
 */
export function formatPrompt(state: ReplState): string {
  return `unireq ${state.currentPath}> `;
}
