/**
 * Ink UI State Types
 *
 * Defines the state structure for the Ink-based terminal UI.
 */

import type { TimingInfo } from '@unireq/http';
import type { LoadedSpec } from '../../openapi/types.js';
import type { WorkspaceConfig } from '../../workspace/config/types.js';
import type { CursorStyle } from '../hooks/useCursor.js';

/**
 * HTTP headers as a record
 */
export type HttpHeaders = Record<string, string>;

/**
 * Cursor settings for input fields
 */
export interface CursorSettings {
  /** Whether the cursor should blink (default: true) */
  blink: boolean;
  /** Blink interval in milliseconds (default: 530ms) */
  blinkInterval: number;
  /** Cursor style (default: 'block') */
  style: CursorStyle;
}

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
  /** Detailed timing information */
  timing?: TimingInfo;
  /** Response size in bytes */
  size: number;
  /** Request method */
  method?: string;
  /** Request URL */
  url?: string;
  /** Request headers that were sent */
  requestHeaders?: HttpHeaders;
  /** Request body that was sent (if any) */
  requestBody?: string;
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
  /** History of HTTP responses for navigation (most recent first) */
  responseHistory: LastResponse[];
  /** Current index in response history (0 = most recent) */
  historyIndex: number;
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
  /** Whether profile config modal is open */
  profileConfigOpen: boolean;
  /** Whether settings modal is open */
  settingsOpen: boolean;

  // === Settings ===
  /** Cursor display settings */
  cursorSettings: CursorSettings;
}

/**
 * Default initial state for Ink UI
 */
/**
 * Default cursor settings
 */
export const defaultCursorSettings: CursorSettings = {
  blink: false, // Disabled to prevent Ink full-screen redraws every 530ms
  blinkInterval: 530,
  style: 'block',
};

export const defaultInkAppState: InkAppState = {
  currentPath: '/',
  transcript: [],
  responseHistory: [],
  historyIndex: 0,
  inputValue: '',
  autocompleteItems: [],
  autocompleteVisible: false,
  selectedAutocompleteIndex: 0,
  inspectorOpen: false,
  historyPickerOpen: false,
  helpOpen: false,
  profileConfigOpen: false,
  settingsOpen: false,
  cursorSettings: defaultCursorSettings,
};
