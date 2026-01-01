/**
 * History module - NDJSON logging for commands and HTTP requests
 */

export { isBinaryBody, redactBody, redactHeaders, truncateBody } from './redactor.js';
export { countEntries, rotateHistory, rotateIfNeeded } from './rotation.js';
export type {
  BaseHistoryEntry,
  CmdEntry,
  HistoryEntry,
  HistoryWriterConfig,
  HttpEntry,
} from './types.js';
export { HISTORY_DEFAULTS } from './types.js';
export { HistoryWriteError, HistoryWriter } from './writer.js';
