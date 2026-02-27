/**
 * Body serializers for request bodies
 * Provides composable body descriptors for JSON, XML, text, binary, and multipart
 */

import { MULTIPART_CONFIG } from '@unireq/config';
import type { BodyDescriptor, MultipartPart } from '@unireq/core';
import { UnireqError } from '@unireq/core';
import { getDataSize } from './internal/size.js';
export { getDataSize } from './internal/size.js';
import { stream as streamBody } from './stream.js';

/**
 * Sanitizes filename to prevent path traversal attacks (OWASP A01:2021)
 * @param filename - Original filename
 * @returns Sanitized filename
 * @see https://owasp.org/www-community/attacks/Path_Traversal
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  return filename
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '__') // Replace directory traversal attempts
    .trim();
}

/**
 * Validates MIME type against allowed list
 * @param contentType - Content-Type to validate
 * @param allowed - List of allowed MIME types (or wildcards like 'image/*')
 * @returns True if valid
 */
function isValidMimeType(contentType: string | undefined, allowed: ReadonlyArray<string>): boolean {
  if (!contentType) return false;

  // Extract base MIME type (ignore parameters like charset)
  const mimeType = contentType.split(';')[0]?.trim().toLowerCase();
  if (!mimeType) return false;

  for (const pattern of allowed) {
    const patternLower = pattern.toLowerCase();

    // Exact match
    if (mimeType === patternLower) return true;

    // Wildcard match (e.g., 'image/*')
    if (patternLower.endsWith('/*')) {
      const prefix = patternLower.slice(0, -2);
      if (mimeType.startsWith(`${prefix}/`)) return true;
    }
  }

  return false;
}

/**
 * Gets size of data
 * @param data - Data to measure
 * @returns Size in bytes
 * @internal Exported for testing - validates size limits for security (DoS prevention)
 */

/** Multipart validation options */
export interface MultipartValidationOptions {
  /** Maximum file size in bytes (default: 100MB) */
  readonly maxFileSize?: number;
  /** Allowed MIME types (default: all allowed) */
  readonly allowedMimeTypes?: ReadonlyArray<string>;
  /** Enable filename sanitization (default: true) */
  readonly sanitizeFilenames?: boolean;
}

/**
 * Body serializers namespace
 * Provides composable BodyDescriptor builders for various content types
 */
export const body = {
  /**
   * Create a JSON body descriptor
   * @param data - Data to serialize as JSON
   * @returns BodyDescriptor for JSON content
   *
   * @example
   * ```ts
   * api.post('/users', body.json({ name: 'John' }))
   * ```
   */
  json: <T>(data: T): BodyDescriptor => ({
    __brand: 'BodyDescriptor',
    data,
    contentType: 'application/json',
    serialize: () => JSON.stringify(data),
  }),

  /**
   * Create a plain text body descriptor
   * @param data - Text content
   * @returns BodyDescriptor for plain text
   *
   * @example
   * ```ts
   * api.post('/notes', body.text('Hello world'))
   * ```
   */
  text: (data: string): BodyDescriptor => ({
    __brand: 'BodyDescriptor',
    data,
    contentType: 'text/plain',
    serialize: () => data,
  }),

  /**
   * Create a URL-encoded form body descriptor (application/x-www-form-urlencoded)
   * @param data - Form data as key-value pairs
   * @returns BodyDescriptor for form data
   *
   * @example
   * ```ts
   * api.post('/login', body.form({ username: 'john', password: 'secret' }))
   * ```
   */
  form: (data: Record<string, string | number | boolean>): BodyDescriptor => ({
    __brand: 'BodyDescriptor',
    data,
    contentType: 'application/x-www-form-urlencoded',
    serialize: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        params.append(key, String(value));
      }
      return params.toString();
    },
  }),

  /**
   * Create a binary body descriptor
   * @param data - Binary data (Blob or ArrayBuffer)
   * @param contentType - MIME type
   * @returns BodyDescriptor for binary content
   *
   * @example
   * ```ts
   * api.post('/upload', body.binary(blob, 'image/png'))
   * ```
   */
  binary: (data: Blob | ArrayBuffer, contentType: string): BodyDescriptor => ({
    __brand: 'BodyDescriptor',
    data,
    contentType,
    serialize: () => (data instanceof Blob ? data : new Blob([data], { type: contentType })),
  }),

  /**
   * Create a multipart/form-data body descriptor with composable parts
   * Supports mixing JSON, XML, text, and binary data in a single request
   *
   * @param parts - Multipart parts (each part is a BodyDescriptor)
   * @param optionsOrPart - Validation options or additional part
   * @returns BodyDescriptor for multipart/form-data
   *
   * @example
   * ```ts
   * api.post('/upload',
   *   body.multipart(
   *     { name: 'metadata', part: body.json({ title: 'Doc' }) },
   *     { name: 'file', part: body.binary(blob, 'application/pdf'), filename: 'doc.pdf' }
   *   )
   * )
   * ```
   */
  multipart: (...partsAndOptions: Array<MultipartPart | MultipartValidationOptions>): BodyDescriptor => {
    // Separate parts from options (last argument might be options object)
    const lastArg = partsAndOptions[partsAndOptions.length - 1];
    const hasOptions =
      lastArg &&
      typeof lastArg === 'object' &&
      !('name' in lastArg && 'part' in lastArg) &&
      (('maxFileSize' in lastArg && typeof lastArg.maxFileSize === 'number') ||
        ('allowedMimeTypes' in lastArg && Array.isArray(lastArg.allowedMimeTypes)) ||
        ('sanitizeFilenames' in lastArg && typeof lastArg.sanitizeFilenames === 'boolean'));

    const parts = hasOptions ? (partsAndOptions.slice(0, -1) as MultipartPart[]) : (partsAndOptions as MultipartPart[]);
    const options = hasOptions ? (lastArg as MultipartValidationOptions) : {};

    const {
      maxFileSize = MULTIPART_CONFIG.MAX_FILE_SIZE,
      allowedMimeTypes,
      sanitizeFilenames = MULTIPART_CONFIG.SANITIZE_FILENAMES,
    } = options;

    // Use default whitelist if not specified
    const effectiveAllowedMimeTypes = allowedMimeTypes ?? [...MULTIPART_CONFIG.DEFAULT_ALLOWED_MIME_TYPES];

    // Security warning if MIME type restrictions are explicitly disabled
    if (effectiveAllowedMimeTypes.length === 0) {
      console.warn(
        '[SECURITY WARNING] MIME type validation disabled. All file types allowed. ' +
          'This creates OWASP A01:2021 vulnerability (unrestricted file upload). ' +
          'Specify allowedMimeTypes for secure uploads.',
      );
    }

    return {
      __brand: 'BodyDescriptor',
      data: parts,
      contentType: 'multipart/form-data',
      serialize: () => {
        const formData = new FormData();

        for (const { name, part, filename } of parts) {
          // Serialize the part's body descriptor
          const serialized = part.serialize();

          // Sanitize filename if provided and enabled
          const sanitizedFilename =
            filename && sanitizeFilenames ? sanitizeFilename(filename) : filename || part.filename;

          // Validate MIME type (always enforced with whitelist)
          if (effectiveAllowedMimeTypes.length > 0 && !isValidMimeType(part.contentType, effectiveAllowedMimeTypes)) {
            throw new UnireqError(
              `Invalid MIME type "${part.contentType}" for part "${name}". Allowed: ${effectiveAllowedMimeTypes.join(', ')}`,
              'VALIDATION_ERROR',
            );
          }

          // Streaming parts not supported in multipart
          if (serialized && typeof serialized === 'object' && 'getReader' in serialized) {
            throw new UnireqError(
              'Streaming parts (ReadableStream) not supported in multipart. Use body.stream() at top level for streaming uploads.',
              'NOT_SUPPORTED',
            );
          }

          // Convert to Blob for FormData compatibility
          let blob: Blob;
          if (serialized instanceof Blob) {
            blob = serialized;
          } else if (serialized instanceof ArrayBuffer) {
            blob = new Blob([serialized], { type: part.contentType });
          } else if (serialized instanceof FormData) {
            // Nested FormData not supported in standard FormData
            throw new UnireqError(
              'Nested FormData not supported. Use body.multipart() at top level only.',
              'NOT_SUPPORTED',
            );
          } else {
            // String
            blob = new Blob([serialized as string], { type: part.contentType || 'text/plain' });
          }

          // Validate file size
          const size = getDataSize(blob);
          if (size > maxFileSize) {
            throw new UnireqError(
              `Part "${name}" exceeds maximum size limit: ${size} bytes > ${maxFileSize} bytes`,
              'VALIDATION_ERROR',
            );
          }

          // Append to FormData
          if (sanitizedFilename) {
            formData.append(name, blob, sanitizedFilename);
          } else {
            formData.append(name, blob);
          }
        }

        return formData;
      },
    };
  },

  /**
   * Create a streaming body descriptor
   * Supports ReadableStream for efficient large file uploads
   *
   * @param stream - ReadableStream containing the data
   * @param options - Stream configuration options
   * @returns BodyDescriptor for streaming content
   *
   * @example
   * ```ts
   * const fileStream = file.stream();
   * api.post('/upload', body.stream(fileStream, { contentType: 'video/mp4', contentLength: file.size }))
   * ```
   */
  stream: streamBody,

  /**
   * Auto-detect body type and create appropriate BodyDescriptor
   *
   * Automatically detects the type of data and uses the appropriate serializer:
   * - Plain object or array → JSON (application/json)
   * - String → Plain text (text/plain)
   * - FormData → Pass through as-is (multipart/form-data)
   * - URLSearchParams → Form encoded (application/x-www-form-urlencoded)
   * - Blob → Binary with blob's type (or application/octet-stream)
   * - ArrayBuffer → Binary (application/octet-stream)
   * - ReadableStream → Streaming (application/octet-stream)
   *
   * Note: XML cannot be auto-detected (objects could be JSON or XML).
   * Use `xmlBody()` from @unireq/xml for XML content.
   *
   * @param data - Data to send (auto-detected type)
   * @returns BodyDescriptor for the appropriate content type
   *
   * @example
   * ```ts
   * // JSON (object/array)
   * api.post('/users', body.auto({ name: 'John' }))
   * // → Content-Type: application/json
   *
   * // Plain text
   * api.post('/notes', body.auto('Hello world'))
   * // → Content-Type: text/plain
   *
   * // FormData (from form)
   * const form = new FormData();
   * form.append('file', blob);
   * api.post('/upload', body.auto(form))
   * // → Content-Type: multipart/form-data
   *
   * // URLSearchParams
   * api.post('/login', body.auto(new URLSearchParams({ user: 'john', pass: 'secret' })))
   * // → Content-Type: application/x-www-form-urlencoded
   *
   * // Blob
   * api.post('/upload', body.auto(imageBlob))
   * // → Content-Type: image/png (from blob) or application/octet-stream
   * ```
   */
  auto: (data: unknown): BodyDescriptor => {
    // Null/undefined → empty body
    if (data === null || data === undefined) {
      return {
        __brand: 'BodyDescriptor',
        data: '',
        contentType: 'text/plain',
        serialize: () => '',
      };
    }

    // String → text/plain
    if (typeof data === 'string') {
      return body.text(data);
    }

    // FormData → pass through
    if (data instanceof FormData) {
      return {
        __brand: 'BodyDescriptor',
        data,
        contentType: 'multipart/form-data',
        serialize: () => data,
      };
    }

    // URLSearchParams → form-encoded
    if (data instanceof URLSearchParams) {
      return {
        __brand: 'BodyDescriptor',
        data,
        contentType: 'application/x-www-form-urlencoded',
        serialize: () => data.toString(),
      };
    }

    // Blob → binary with blob's type
    if (data instanceof Blob) {
      return {
        __brand: 'BodyDescriptor',
        data,
        contentType: data.type || 'application/octet-stream',
        serialize: () => data,
      };
    }

    // ArrayBuffer → binary
    if (data instanceof ArrayBuffer) {
      return {
        __brand: 'BodyDescriptor',
        data,
        contentType: 'application/octet-stream',
        serialize: () => new Blob([data], { type: 'application/octet-stream' }),
      };
    }

    // ReadableStream → streaming
    if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
      return streamBody(data as ReadableStream<Uint8Array>, { contentType: 'application/octet-stream' });
    }

    // Object or Array → JSON
    if (typeof data === 'object') {
      return body.json(data);
    }

    // Fallback for other primitives (number, boolean) → JSON
    return body.json(data);
  },
};
