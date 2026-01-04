/**
 * Binary content detection utilities
 *
 * Detects binary content by content-type header and data inspection.
 */

/**
 * Content types that indicate binary data
 * Matches prefix patterns (e.g., 'image/' matches 'image/png')
 */
const BINARY_CONTENT_TYPE_PREFIXES = [
  'image/',
  'audio/',
  'video/',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-executable',
  'application/x-mach-binary',
  'application/x-dosexec',
  'application/msword',
  'application/vnd.', // Office documents (vnd.openxmlformats, vnd.ms-excel, etc.)
];

/**
 * Text subtypes that should NOT be treated as binary
 * These are exceptions within binary type families (e.g., image/svg+xml is text)
 */
const TEXT_SUBTYPES = ['svg+xml', '+xml', '+json', 'xml', 'json', 'javascript', 'html', 'css', 'text'];

/**
 * Check if a content-type indicates binary content
 *
 * @param contentType - Content-Type header value
 * @returns true if content-type indicates binary
 *
 * @example
 * isBinaryContentType('image/png') // true
 * isBinaryContentType('application/json') // false
 * isBinaryContentType('image/svg+xml') // false (SVG is text)
 */
export function isBinaryContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }

  const normalizedType = contentType.toLowerCase().split(';')[0]?.trim() || '';

  // Check if it's text/*
  if (normalizedType.startsWith('text/')) {
    return false;
  }

  // Check for structured syntax suffixes (+xml, +json) - these are ALWAYS text
  // These take priority even over binary prefixes because they indicate
  // human-readable data formats (e.g., application/vnd.api+json is JSON API spec)
  if (normalizedType.endsWith('+json') || normalizedType.endsWith('+xml')) {
    return false;
  }

  // Check for binary content type prefixes
  // These match before generic text subtype checks because things like
  // application/vnd.openxmlformats contain "xml" but are still binary (ZIP archives)
  for (const prefix of BINARY_CONTENT_TYPE_PREFIXES) {
    if (normalizedType.startsWith(prefix)) {
      return true;
    }
  }

  // Check for text subtype indicators in non-binary types
  // e.g., application/json, application/xml, image/svg+xml
  for (const textSubtype of TEXT_SUBTYPES) {
    if (normalizedType.includes(textSubtype)) {
      return false;
    }
  }

  return false;
}

/**
 * Check if data contains binary content (null bytes or high non-printable ratio)
 *
 * @param data - Response data (string, Buffer, or object)
 * @returns true if data appears to be binary
 *
 * @example
 * isBinaryData('{"foo": "bar"}') // false
 * isBinaryData('hello\x00world') // true (contains null byte)
 */
export function isBinaryData(data: unknown): boolean {
  if (data === null || data === undefined) {
    return false;
  }

  // Objects are JSON, not binary
  if (typeof data === 'object' && !Buffer.isBuffer(data)) {
    return false;
  }

  // Check Buffer
  if (Buffer.isBuffer(data)) {
    return containsBinaryBytes(data);
  }

  // Check string
  if (typeof data === 'string') {
    return containsBinaryChars(data);
  }

  return false;
}

/**
 * Check if a Buffer contains binary bytes (null bytes or high non-printable ratio)
 */
function containsBinaryBytes(buffer: Buffer): boolean {
  // Null byte is definitive binary indicator
  if (buffer.includes(0)) {
    return true;
  }

  // Check ratio of non-printable bytes
  // Sample first 1KB to avoid processing huge files
  const sampleSize = Math.min(buffer.length, 1024);
  let nonPrintable = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    // Non-printable: < 32 (control chars) except 9 (tab), 10 (LF), 13 (CR)
    // Guard is technically redundant (i < sampleSize <= buffer.length) but satisfies TS
    if (byte !== undefined && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonPrintable++;
    }
  }

  // > 10% non-printable suggests binary
  return nonPrintable / sampleSize > 0.1;
}

/**
 * Check if a string contains binary characters
 */
function containsBinaryChars(str: string): boolean {
  // Null byte is definitive binary indicator
  if (str.includes('\0')) {
    return true;
  }

  // Check ratio of non-printable chars
  // Sample first 1KB to avoid processing huge strings
  const sampleSize = Math.min(str.length, 1024);
  let nonPrintable = 0;

  for (let i = 0; i < sampleSize; i++) {
    const code = str.charCodeAt(i);
    // Non-printable: < 32 (control chars) except 9 (tab), 10 (LF), 13 (CR)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }

  // > 10% non-printable suggests binary
  return nonPrintable / sampleSize > 0.1;
}

/**
 * Format size for display (human readable)
 *
 * @param bytes - Size in bytes
 * @returns Human-readable size string (e.g., "1.5 KB")
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) {
    return '0 bytes';
  }

  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a placeholder message for binary content
 *
 * @param size - Size in bytes
 * @param contentType - Content-Type header value
 * @returns Placeholder string like "[Binary data: 1.5 KB, image/png]"
 *
 * @example
 * formatBinaryPlaceholder(1536, 'image/png')
 * // "[Binary data: 1.5 KB, image/png]"
 */
export function formatBinaryPlaceholder(size: number, contentType: string | undefined): string {
  const sizeStr = formatSize(size);
  const typeStr = contentType?.split(';')[0]?.trim() || 'unknown';
  return `[Binary data: ${sizeStr}, ${typeStr}]`;
}
