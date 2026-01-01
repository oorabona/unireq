/**
 * Output formatting module
 */

export { bold, dim, getStatusColor, shouldUseColors } from './colors.js';
export { formatJson, formatPretty, formatRaw, formatResponse } from './formatter.js';
export type { HighlightType } from './highlighter.js';
export { detectContentType, highlight, highlightJson, highlightXml } from './highlighter.js';
export type { TraceOptions } from './trace.js';
export { formatTrace, formatTraceCompact } from './trace.js';
export type { FormattableResponse, OutputMode, OutputOptions } from './types.js';
