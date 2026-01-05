/**
 * Ink UI State Types
 *
 * Defines the state structure for the Ink-based terminal UI.
 */

import type { LoadedSpec } from '../../openapi/types.js';
import type { WorkspaceConfig } from '../../workspace/config/types.js';

/**
 * HTTP headers as a record
 */
export type HttpHeaders = Record<string, string>;

/**
 * Transcript event types
 */
export type TranscriptEventType = 'command' | 'result' | 'error' | 'notice' | 'meta';

/**
 * Result content for HTTP responses
 */
export interface ResultContent {
  /** HTTP status code */
  status: number;
  /** HTTP status text (e.g., "OK", "Not Found") */
  statusText: string;
  /** Request timing in milliseconds */
  timing: number;
  /** Response size in bytes */
  size: number;
  /** Truncated body preview for display */
  bodyPreview: string;
  /** Full body for inspector */
  bodyFull: string;
  /** Response headers (optional) */
  headers?: HttpHeaders;
}

/**
 * A single event in the transcript (command, result, error, notice)
 */
export interface TranscriptEvent {
  /** Unique event ID */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  type: TranscriptEventType;
  /** Event content (string for commands, ResultContent for results) */
  content: string | ResultContent;
}

/**
 * Last HTTP response information
 */
export interface LastResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: HttpHeaders;
  /** Full response body */
  body: string;
  /** Request timing in milliseconds */
  timing: number;
  /** Response size in bytes */
  size: number;
}

/**
 * Ink UI Application State
 *
 * Extends the base ReplState with UI-specific state for the Ink renderer.
 */
export interface InkAppState {
  // === From existing ReplState ===
  /** Active workspace path */
  workspace?: string;
  /** Active workspace name (for display) */
  workspaceName?: string;
  /** Loaded workspace configuration */
  workspaceConfig?: WorkspaceConfig;
  /** Current navigation path */
  currentPath: string;
  /** Active profile name */
  activeProfile?: string;
  /** Loaded OpenAPI specification */
  spec?: LoadedSpec;

  // === New for Ink UI ===
  /** Transcript of commands and results */
  transcript: TranscriptEvent[];
  /** Last HTTP response (for inspector) */
  lastResponse?: LastResponse;
  /** Current input value */
  inputValue: string;
  /** Autocomplete suggestion items */
  autocompleteItems: string[];
  /** Whether autocomplete popup is visible */
  autocompleteVisible: boolean;
  /** Selected autocomplete item index */
  selectedAutocompleteIndex: number;

  // === Modal states ===
  /** Whether inspector modal is open */
  inspectorOpen: boolean;
  /** Whether history picker is open */
  historyPickerOpen: boolean;
  /** Whether help panel is open */
  helpOpen: boolean;
}

/**
 * Default initial state for Ink UI
 */
export const defaultInkAppState: InkAppState = {
  currentPath: '/',
  transcript: [],
  inputValue: '',
  autocompleteItems: [],
  autocompleteVisible: false,
  selectedAutocompleteIndex: 0,
  inspectorOpen: false,
  historyPickerOpen: false,
  helpOpen: false,
};
