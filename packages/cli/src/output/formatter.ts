/**
 * Response formatter - formats HTTP responses for display
 */

import { formatBinaryPlaceholder, formatSize, isBinaryContentType, isBinaryData } from './binary.js';
import { dim, getStatusColor, shouldUseColors } from './colors.js';
import { highlight } from './highlighter.js';
import { redactHeaders } from './redactor.js';
import type { FormattableResponse, OutputOptions } from './types.js';

/**
 * Format response headers as indented key: value pairs
 */
function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n');
}

/**
 * Format response body
 * Pretty-prints JSON if content-type indicates JSON
 * Applies syntax highlighting when colors are enabled
 * Detects binary content and displays placeholder
 */
function formatBody(data: unknown, contentType: string | undefined, useColors: boolean): string {
  if (data === null || data === undefined) {
    return '';
  }

  // Check for binary content (by content-type or data inspection)
  if (isBinaryContentType(contentType) || isBinaryData(data)) {
    const size = calculateSize(data);
    return dim(formatBinaryPlaceholder(size, contentType), useColors);
  }

  // If already parsed as object and content-type is JSON, pretty-print
  if (typeof data === 'object' && contentType?.includes('json')) {
    const formatted = JSON.stringify(data, null, 2);
    return highlight(formatted, contentType, useColors);
  }

  // If string and looks like JSON, try to pretty-print
  if (typeof data === 'string') {
    if (contentType?.includes('json')) {
      try {
        const formatted = JSON.stringify(JSON.parse(data), null, 2);
        return highlight(formatted, contentType, useColors);
      } catch {
        return data;
      }
    }
    // Apply highlighting for other text content types (e.g., XML)
    return highlight(data, contentType, useColors);
  }

  // Fallback: stringify
  return String(data);
}

/**
 * Calculate approximate size in bytes
 */
function calculateSize(data: unknown): number {
  if (data === null || data === undefined) {
    return 0;
  }

  if (typeof data === 'string') {
    return Buffer.byteLength(data, 'utf8');
  }

  if (typeof data === 'object') {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  return String(data).length;
}

/**
 * Options for pretty formatting
 */
interface PrettyFormatOptions {
  useColors: boolean;
  showSecrets?: boolean;
  redactionPatterns?: readonly string[];
  includeHeaders?: boolean;
  showSummary?: boolean;
  hideBody?: boolean;
}

/**
 * Format response in pretty mode (colored, formatted)
 * By default outputs body only (pipe-friendly, scriptable)
 * Use includeHeaders=true for status line and headers
 * Use showSummary=true for footer with status and size
 */
export function formatPretty(response: FormattableResponse, options: PrettyFormatOptions): string {
  const {
    useColors,
    showSecrets = false,
    redactionPatterns = [],
    includeHeaders = false,
    showSummary = false,
    hideBody = false,
  } = options;
  const lines: string[] = [];
  const colorFn = getStatusColor(response.status, useColors);

  // Status line and headers (only when requested)
  if (includeHeaders) {
    const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}`;
    lines.push(colorFn(statusLine));

    if (Object.keys(response.headers).length > 0) {
      const redactedHeaders = redactHeaders(response.headers, {
        showSecrets,
        additionalPatterns: redactionPatterns,
      });
      lines.push(formatHeaders(redactedHeaders));
    }
    lines.push(''); // Blank line separator before body
  }

  // Body (with syntax highlighting when colors enabled) - skip if hideBody
  if (!hideBody) {
    const contentType = response.headers['content-type'] || response.headers['Content-Type'];
    const formattedBody = formatBody(response.data, contentType, useColors);
    if (formattedBody) {
      lines.push(formattedBody);
    }
  }

  // Summary line (only when requested)
  if (showSummary) {
    const size = calculateSize(response.data);
    const summaryLine = `── ${response.status} ${response.statusText} · ${formatSize(size)} ──`;
    lines.push('');
    lines.push(dim(summaryLine, useColors));
  }

  return lines.join('\n');
}

/**
 * Options for JSON formatting
 */
interface JsonFormatOptions {
  showSecrets?: boolean;
  redactionPatterns?: readonly string[];
  hideBody?: boolean;
}

/**
 * Format response in JSON mode (machine-readable)
 * For binary content, body is replaced with metadata
 */
export function formatJson(response: FormattableResponse, options: JsonFormatOptions = {}): string {
  const { showSecrets = false, redactionPatterns = [], hideBody = false } = options;

  const headers = redactHeaders(response.headers, {
    showSecrets,
    additionalPatterns: redactionPatterns,
  });

  const contentType = response.headers['content-type'] || response.headers['Content-Type'];

  const output: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: unknown;
    binaryContent?: { size: number; contentType: string | undefined };
  } = {
    status: response.status,
    statusText: response.statusText,
    headers,
  };

  // Only include body if not hidden
  if (!hideBody) {
    // For binary content, include metadata instead of raw data
    if (isBinaryContentType(contentType) || isBinaryData(response.data)) {
      output.binaryContent = {
        size: calculateSize(response.data),
        contentType,
      };
    } else {
      output.body = response.data;
    }
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Format response in raw mode (body only)
 * For binary content, outputs placeholder unless --output is specified
 */
export function formatRaw(response: FormattableResponse, options?: { hideBody?: boolean }): string {
  // If hideBody is set, return empty string (raw mode is body-only)
  if (options?.hideBody) {
    return '';
  }

  if (response.data === null || response.data === undefined) {
    return '';
  }

  // Check for binary content - return placeholder to avoid garbled output
  const contentType = response.headers['content-type'] || response.headers['Content-Type'];
  if (isBinaryContentType(contentType) || isBinaryData(response.data)) {
    const size = calculateSize(response.data);
    return formatBinaryPlaceholder(size, contentType);
  }

  if (typeof response.data === 'string') {
    return response.data;
  }

  if (typeof response.data === 'object') {
    return JSON.stringify(response.data);
  }

  return String(response.data);
}

/**
 * Format response based on output mode
 */
export function formatResponse(response: FormattableResponse, options: OutputOptions): string {
  const {
    mode,
    showSecrets = false,
    redactionPatterns = [],
    includeHeaders = false,
    showSummary = false,
    hideBody = false,
  } = options;

  switch (mode) {
    case 'json':
      return formatJson(response, { showSecrets, redactionPatterns, hideBody });
    case 'raw':
      return formatRaw(response, { hideBody });
    default: {
      const useColors = shouldUseColors(options.forceColors);
      return formatPretty(response, {
        useColors,
        showSecrets,
        redactionPatterns,
        includeHeaders,
        showSummary,
        hideBody,
      });
    }
  }
}
