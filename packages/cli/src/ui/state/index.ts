/**
 * Ink UI State Module
 *
 * Re-exports state types, reducer, and context for the Ink-based terminal UI.
 */

export { InkStateProvider, useInkState } from './context.js';
export { type InkAction, inkReducer } from './reducer.js';
export {
  defaultInkAppState,
  type HttpHeaders,
  type InkAppState,
  type LastResponse,
  type ResultContent,
  type TranscriptEvent,
  type TranscriptEventType,
} from './types.js';
