/**
 * REPL session state management
 */

import { join } from 'node:path';
import type { TimingInfo } from '@unireq/http';
import type { HistoryWriter } from '../collections/history/index.js';
import type { NavigationTree } from '../openapi/navigation/types.js';
import type { LoadedSpec } from '../openapi/types.js';
import type { IVault } from '../secrets/types.js';
import type { ParsedRequest } from '../types.js';
import type { HttpOutputDefaults, WorkspaceConfig } from '../workspace/config/types.js';
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
  /** Last response body (for extract command and inspector) */
  lastResponseBody?: string;
  /** Last response status code */
  lastResponseStatus?: number;
  /** Last response status text */
  lastResponseStatusText?: string;
  /** Last response headers */
  lastResponseHeaders?: Record<string, string>;
  /** Last response timing information */
  lastResponseTiming?: TimingInfo;
  /** Last request method (for inspector display) */
  lastRequestMethod?: string;
  /** Last request URL (for inspector display) */
  lastRequestUrl?: string;
  /** Last request headers (for inspector display) */
  lastRequestHeaders?: Record<string, string>;
  /** Last request body (for inspector display) */
  lastRequestBody?: string;
  /** Extracted variables from responses (for request chaining) */
  extractedVars?: Record<string, string>;
  /** History writer for logging commands and requests */
  historyWriter?: HistoryWriter;
  /**
   * Whether running in interactive REPL mode
   * When true, @clack/prompts should NOT be used (terminal conflict)
   * Commands should require all arguments instead of interactive prompts
   */
  isReplMode?: boolean;
  /**
   * Session-level HTTP output default overrides (ephemeral)
   * Set via `defaults set <key> <value>` command
   * Lost on REPL exit, highest priority after CLI flags
   */
  sessionDefaults?: HttpOutputDefaults;
  /**
   * Pending modal to open (set by commands, consumed by UI)
   * Used to trigger modals from command handlers
   */
  pendingModal?: 'profileConfig';
}

/** Default history file name */
const HISTORY_FILE = 'history.ndjson';

/**
 * Get the path for history file based on workspace or global config
 *
 * @param workspace - The workspace path (already the .unireq directory, not project root)
 */
export function getHistoryPath(workspace?: string): string | null {
  if (workspace) {
    // Use workspace-specific history
    // Note: workspace is already the .unireq directory path, don't add .unireq again
    return join(workspace, HISTORY_FILE);
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
