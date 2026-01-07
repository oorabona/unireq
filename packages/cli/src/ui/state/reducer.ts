/**
 * Ink UI State Reducer
 *
 * Handles state updates for the Ink-based terminal UI.
 */

import type { WorkspaceConfig } from '../../workspace/config/types.js';
import type { CursorSettings, InkAppState, LastResponse, TranscriptEvent } from './types.js';

/**
 * Action types for the reducer
 */
export type InkAction =
  | { type: 'ADD_TRANSCRIPT'; event: Omit<TranscriptEvent, 'id' | 'timestamp'> }
  | { type: 'SET_LAST_RESPONSE'; response: LastResponse }
  | { type: 'CLEAR_LAST_RESPONSE' }
  | { type: 'SET_HISTORY_INDEX'; index: number }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SET_CURRENT_PATH'; path: string }
  | { type: 'SET_ACTIVE_PROFILE'; profile: string | undefined }
  | {
      type: 'SET_WORKSPACE';
      workspace: string | undefined;
      workspaceName: string | undefined;
      config: WorkspaceConfig | undefined;
    }
  | { type: 'SET_AUTOCOMPLETE_ITEMS'; items: string[] }
  | { type: 'SET_AUTOCOMPLETE_VISIBLE'; visible: boolean }
  | { type: 'SET_AUTOCOMPLETE_INDEX'; index: number }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'TOGGLE_HISTORY_PICKER' }
  | { type: 'TOGGLE_HELP' }
  | { type: 'TOGGLE_PROFILE_CONFIG' }
  | { type: 'CLOSE_ALL_MODALS' }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'SET_CURSOR_SETTINGS'; settings: Partial<CursorSettings> };

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Maximum number of events to keep in transcript
 */
const MAX_TRANSCRIPT_EVENTS = 500;

/**
 * Maximum number of responses to keep in history
 */
const MAX_RESPONSE_HISTORY = 50;

/**
 * State reducer for Ink UI
 *
 * @param state - Current state
 * @param action - Action to apply
 * @returns New state
 */
export function inkReducer(state: InkAppState, action: InkAction): InkAppState {
  switch (action.type) {
    case 'ADD_TRANSCRIPT': {
      const event: TranscriptEvent = {
        id: generateEventId(),
        timestamp: new Date(),
        type: action.event.type,
        content: action.event.content,
      };

      // Keep only the last MAX_TRANSCRIPT_EVENTS
      const newTranscript = [...state.transcript, event];
      if (newTranscript.length > MAX_TRANSCRIPT_EVENTS) {
        newTranscript.splice(0, newTranscript.length - MAX_TRANSCRIPT_EVENTS);
      }

      return {
        ...state,
        transcript: newTranscript,
      };
    }

    case 'SET_LAST_RESPONSE': {
      // Prepend to history (most recent first) and limit size
      const newHistory = [action.response, ...state.responseHistory];
      if (newHistory.length > MAX_RESPONSE_HISTORY) {
        newHistory.splice(MAX_RESPONSE_HISTORY);
      }
      return {
        ...state,
        lastResponse: action.response,
        responseHistory: newHistory,
        historyIndex: 0, // Reset to most recent
      };
    }

    case 'CLEAR_LAST_RESPONSE':
      return {
        ...state,
        lastResponse: undefined,
      };

    case 'SET_HISTORY_INDEX':
      return {
        ...state,
        historyIndex: Math.max(0, Math.min(action.index, state.responseHistory.length - 1)),
      };

    case 'SET_INPUT':
      return {
        ...state,
        inputValue: action.value,
      };

    case 'SET_CURRENT_PATH':
      return {
        ...state,
        currentPath: action.path,
      };

    case 'SET_ACTIVE_PROFILE':
      return {
        ...state,
        activeProfile: action.profile,
      };

    case 'SET_WORKSPACE':
      return {
        ...state,
        workspace: action.workspace,
        workspaceName: action.workspaceName,
        workspaceConfig: action.config,
      };

    case 'SET_AUTOCOMPLETE_ITEMS':
      return {
        ...state,
        autocompleteItems: action.items,
        autocompleteVisible: action.items.length > 0,
        selectedAutocompleteIndex: 0,
      };

    case 'SET_AUTOCOMPLETE_VISIBLE':
      return {
        ...state,
        autocompleteVisible: action.visible,
        selectedAutocompleteIndex: action.visible ? state.selectedAutocompleteIndex : 0,
      };

    case 'SET_AUTOCOMPLETE_INDEX':
      return {
        ...state,
        selectedAutocompleteIndex: Math.max(0, Math.min(action.index, state.autocompleteItems.length - 1)),
      };

    case 'TOGGLE_INSPECTOR':
      return {
        ...state,
        inspectorOpen: !state.inspectorOpen,
        historyPickerOpen: false,
        helpOpen: false,
        profileConfigOpen: false,
      };

    case 'TOGGLE_HISTORY_PICKER':
      return {
        ...state,
        historyPickerOpen: !state.historyPickerOpen,
        inspectorOpen: false,
        helpOpen: false,
        profileConfigOpen: false,
      };

    case 'TOGGLE_HELP':
      return {
        ...state,
        helpOpen: !state.helpOpen,
        inspectorOpen: false,
        historyPickerOpen: false,
        profileConfigOpen: false,
      };

    case 'TOGGLE_PROFILE_CONFIG':
      return {
        ...state,
        profileConfigOpen: !state.profileConfigOpen,
        inspectorOpen: false,
        historyPickerOpen: false,
        helpOpen: false,
      };

    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        inspectorOpen: false,
        historyPickerOpen: false,
        helpOpen: false,
        profileConfigOpen: false,
      };

    case 'CLEAR_TRANSCRIPT':
      return {
        ...state,
        transcript: [],
      };

    case 'SET_CURSOR_SETTINGS':
      return {
        ...state,
        cursorSettings: {
          ...state.cursorSettings,
          ...action.settings,
        },
      };

    default:
      return state;
  }
}
