/**
 * Multipart form data support (RFC 7578)
 * @see https://datatracker.ietf.org/doc/html/rfc7578
 */

import { MULTIPART_CONFIG } from '@unireq/config';
import type { Policy } from '@unireq/core';
import { UnireqError } from '@unireq/core';
import type { MultipartValidationOptions } from './body.js';
import { getDataSize } from './internal/size.js';

/** File to upload in multipart form */
export interface MultipartFile {
  readonly name: string;
  readonly filename: string;
  readonly data: Blob | ReadableStream | ArrayBuffer | string;
  readonly contentType?: string;
}

/** Multipart form field */
export interface MultipartField {
  readonly name: string;
  readonly value: string;
}

/** Multipart upload validation options */

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
 * Gets size of multipart data
 * @param data - File data
 * @returns Size in bytes
 */

/**
 * Creates a multipart/form-data policy with security validation
 * @param files - Files to upload
 * @param fields - Additional form fields
 * @param options - Validation options
 * @returns Policy that sends multipart form data
 *
 * @example
 * ```ts
 * const uploadPolicy = multipart(
 *   [{ name: 'file', filename: 'doc.pdf', data: blob, contentType: 'application/pdf' }],
 *   [{ name: 'title', value: 'My Document' }],
 *   { maxFileSize: 10_000_000, allowedMimeTypes: ['application/pdf', 'image/*'] }
 * );
 * ```
 */
export function multipart(
  files: ReadonlyArray<MultipartFile>,
  fields: ReadonlyArray<MultipartField> = [],
  options: MultipartValidationOptions = {},
): Policy {
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

  return async (ctx, next) => {
    const formData = new FormData();

    // Add fields
    for (const field of fields) {
      formData.append(field.name, field.value);
    }

    // Add files with validation
    for (const file of files) {
      // Sanitize filename if enabled
      const filename = sanitizeFilenames ? sanitizeFilename(file.filename) : file.filename;

      // Validate MIME type (always enforced with whitelist)
      if (effectiveAllowedMimeTypes.length > 0 && !isValidMimeType(file.contentType, effectiveAllowedMimeTypes)) {
        throw new UnireqError(
          `Invalid MIME type "${file.contentType}" for file "${filename}". Allowed: ${effectiveAllowedMimeTypes.join(', ')}`,
          'VALIDATION_ERROR',
        );
      }

      let blob: Blob;

      if (file.data instanceof Blob) {
        blob = file.data;
      } else if (file.data instanceof ArrayBuffer) {
        blob = new Blob([file.data], { type: file.contentType });
      } else if (typeof file.data === 'string') {
        blob = new Blob([file.data], { type: file.contentType || 'text/plain' });
      } else {
        // ReadableStream - not directly supported by FormData in all environments
        throw new UnireqError('ReadableStream not yet supported for multipart uploads', 'NOT_SUPPORTED');
      }

      // Validate file size
      const fileSize = getDataSize(file.data);
      if (fileSize > maxFileSize) {
        throw new UnireqError(
          `File "${filename}" exceeds maximum size limit: ${fileSize} bytes > ${maxFileSize} bytes`,
          'VALIDATION_ERROR',
        );
      }

      formData.append(file.name, blob, filename);
    }

    return next({
      ...ctx,
      body: formData,
      headers: ctx.headers,
    });
  };
}
