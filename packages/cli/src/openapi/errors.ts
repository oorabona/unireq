/**
 * OpenAPI Spec Loader Errors
 * @module openapi/errors
 */

/**
 * Base error for all spec loading errors
 */
export class SpecError extends Error {
  readonly source?: string;

  constructor(message: string, source?: string) {
    super(message);
    this.name = 'SpecError';
    this.source = source;
    Object.setPrototypeOf(this, SpecError.prototype);
  }
}

/**
 * Error thrown when spec file or URL is not found
 */
export class SpecNotFoundError extends SpecError {
  constructor(source: string, details?: string) {
    const message = details ? `Spec not found: ${source} (${details})` : `Spec not found: ${source}`;
    super(message, source);
    this.name = 'SpecNotFoundError';
    Object.setPrototypeOf(this, SpecNotFoundError.prototype);
  }
}

/**
 * Error thrown when spec cannot be loaded (network, permission, etc.)
 */
export class SpecLoadError extends SpecError {
  override readonly cause?: Error;

  constructor(source: string, reason: string, cause?: Error) {
    super(`Failed to load spec from ${source}: ${reason}`, source);
    this.name = 'SpecLoadError';
    this.cause = cause;
    Object.setPrototypeOf(this, SpecLoadError.prototype);
  }
}

/**
 * Error thrown when spec content is invalid
 */
export class SpecParseError extends SpecError {
  readonly line?: number;
  readonly column?: number;

  constructor(source: string, reason: string, options?: { line?: number; column?: number }) {
    const location =
      options?.line !== undefined
        ? ` at line ${options.line}${options.column !== undefined ? `, column ${options.column}` : ''}`
        : '';
    super(`Invalid spec ${source}${location}: ${reason}`, source);
    this.name = 'SpecParseError';
    this.line = options?.line;
    this.column = options?.column;
    Object.setPrototypeOf(this, SpecParseError.prototype);
  }
}
