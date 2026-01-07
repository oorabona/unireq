/**
 * Format auto-detection for import files
 * Detects: Postman v2.1, Insomnia v4, HAR 1.2, cURL commands
 */

import { isCurlCommand } from './curl.js';
import { parseHarArchive, parseInsomniaExport, parsePostmanCollection } from './schemas.js';
import type { FormatDetectionResult, ImportFormat } from './types.js';
import { ImportError } from './types.js';

/**
 * Postman v2.1 schema URL pattern
 */
const POSTMAN_V21_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1';
const POSTMAN_V20_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.0';

/**
 * Detect format from parsed JSON data
 *
 * @param data - Parsed JSON object
 * @returns Detection result with format, version, and confidence
 * @throws ImportError if format cannot be detected
 *
 * @example
 * ```ts
 * const json = JSON.parse(fileContent);
 * const result = detectFormat(json);
 * // { format: 'postman', version: '2.1.0', confidence: 'high' }
 * ```
 */
export function detectFormat(data: unknown): FormatDetectionResult {
  if (typeof data !== 'object' || data === null) {
    throw new ImportError('UNSUPPORTED_FORMAT', 'Input is not a valid JSON object');
  }

  const obj = data as Record<string, unknown>;

  // Check for Postman collection (has info.schema)
  if (isPostmanCollection(obj)) {
    return detectPostmanVersion(obj);
  }

  // Check for Insomnia export (has _type: 'export')
  if (isInsomniaExport(obj)) {
    return detectInsomniaVersion(obj);
  }

  // Check for HAR archive (has log.version)
  if (isHarArchive(obj)) {
    return detectHarVersion(obj);
  }

  throw new ImportError(
    'UNSUPPORTED_FORMAT',
    'Unable to detect format. Expected Postman Collection, Insomnia Export, or HAR Archive.',
  );
}

/**
 * Check if data looks like a Postman collection
 */
function isPostmanCollection(data: Record<string, unknown>): boolean {
  if (typeof data['info'] !== 'object' || data['info'] === null) {
    return false;
  }
  const info = data['info'] as Record<string, unknown>;
  return typeof info['schema'] === 'string' && Array.isArray(data['item']);
}

/**
 * Check if data looks like an Insomnia export
 */
function isInsomniaExport(data: Record<string, unknown>): boolean {
  return data['_type'] === 'export' && typeof data['__export_format'] === 'number';
}

/**
 * Check if data looks like a HAR archive
 */
function isHarArchive(data: Record<string, unknown>): boolean {
  if (typeof data['log'] !== 'object' || data['log'] === null) {
    return false;
  }
  const log = data['log'] as Record<string, unknown>;
  return typeof log['version'] === 'string' && Array.isArray(log['entries']);
}

/**
 * Detect Postman version from schema URL
 */
function detectPostmanVersion(data: Record<string, unknown>): FormatDetectionResult {
  const info = data['info'] as Record<string, unknown>;
  const schema = info['schema'] as string;

  if (schema.startsWith(POSTMAN_V21_SCHEMA)) {
    const result = parsePostmanCollection(data);
    return {
      format: 'postman',
      version: '2.1.0',
      confidence: result.success ? 'high' : 'medium',
    };
  }

  if (schema.startsWith(POSTMAN_V20_SCHEMA)) {
    throw new ImportError(
      'UNSUPPORTED_VERSION',
      'Postman Collection v2.0 is not supported. Please export using v2.1 format.',
      { detectedVersion: '2.0.0' },
    );
  }

  // Unknown version but has Postman structure
  const result = parsePostmanCollection(data);
  return {
    format: 'postman',
    version: extractVersionFromSchema(schema),
    confidence: result.success ? 'medium' : 'low',
  };
}

/**
 * Detect Insomnia version from export format
 */
function detectInsomniaVersion(data: Record<string, unknown>): FormatDetectionResult {
  const exportFormat = data['__export_format'] as number;

  if (exportFormat === 4) {
    const result = parseInsomniaExport(data);
    return {
      format: 'insomnia',
      version: '4',
      confidence: result.success ? 'high' : 'medium',
    };
  }

  if (exportFormat < 4) {
    throw new ImportError(
      'UNSUPPORTED_VERSION',
      `Insomnia export format ${exportFormat} is not supported. Please export using format 4.`,
      { detectedVersion: String(exportFormat) },
    );
  }

  // Newer format, try anyway
  const result = parseInsomniaExport(data);
  return {
    format: 'insomnia',
    version: String(exportFormat),
    confidence: result.success ? 'medium' : 'low',
  };
}

/**
 * Detect HAR version
 */
function detectHarVersion(data: Record<string, unknown>): FormatDetectionResult {
  const log = data['log'] as Record<string, unknown>;
  const version = log['version'] as string;

  if (version === '1.2') {
    const result = parseHarArchive(data);
    return {
      format: 'har',
      version: '1.2',
      confidence: result.success ? 'high' : 'medium',
    };
  }

  if (version === '1.1') {
    // HAR 1.1 is mostly compatible with 1.2
    const result = parseHarArchive(data);
    return {
      format: 'har',
      version: '1.1',
      confidence: result.success ? 'medium' : 'low',
    };
  }

  // Unknown version
  const result = parseHarArchive(data);
  return {
    format: 'har',
    version,
    confidence: result.success ? 'low' : 'low',
  };
}

/**
 * Extract version number from Postman schema URL
 */
function extractVersionFromSchema(schema: string): string {
  const match = schema.match(/v(\d+\.\d+\.\d+)/);
  return match?.[1] ?? 'unknown';
}

/**
 * Parse content and detect format in one step
 * Supports JSON formats (Postman, Insomnia, HAR) and cURL commands
 *
 * @param content - Raw content string (JSON or cURL command)
 * @returns Detection result with format, version, and confidence
 * @throws ImportError if format cannot be detected
 */
export function detectFormatFromString(content: string): FormatDetectionResult {
  const trimmed = content.trim();

  // Check for cURL command first (before trying JSON parse)
  if (isCurlCommand(trimmed)) {
    return {
      format: 'curl',
      version: '1.0',
      confidence: 'high',
    };
  }

  // Try JSON parsing
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (error) {
    const parseError = error as SyntaxError;
    throw new ImportError('INVALID_JSON', `Invalid JSON: ${parseError.message}`);
  }

  return detectFormat(data);
}

/**
 * Get format display name
 */
export function getFormatDisplayName(format: ImportFormat): string {
  switch (format) {
    case 'postman':
      return 'Postman Collection';
    case 'insomnia':
      return 'Insomnia Export';
    case 'har':
      return 'HAR Archive';
    case 'curl':
      return 'cURL Command';
  }
}

/**
 * Get format file extension hint
 */
export function getFormatFileExtension(format: ImportFormat): string {
  switch (format) {
    case 'postman':
      return '.postman_collection.json';
    case 'insomnia':
      return '.json';
    case 'har':
      return '.har';
    case 'curl':
      return '.sh';
  }
}
