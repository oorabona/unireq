/**
 * History module - NDJSON logging for commands and HTTP requests
 */

export { HistoryReadError, HistoryReader } from './reader.js';
export type { HistoryFilter, HistoryListResult } from './reader.js';
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
