/**
 * Workspace configuration errors
 */

/**
 * Error thrown when workspace configuration is invalid
 */
export class WorkspaceConfigError extends Error {
  /** Field path that caused the error (for schema errors) */
  readonly fieldPath?: string;
  /** Line number in YAML file (for syntax errors) */
  readonly line?: number;
  /** Column number in YAML file (for syntax errors) */
  readonly column?: number;
  /** Original error that caused this error */
  override readonly cause?: Error;

  constructor(
    message: string,
    options?: {
      fieldPath?: string;
      line?: number;
      column?: number;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'WorkspaceConfigError';
    this.fieldPath = options?.fieldPath;
    this.line = options?.line;
    this.column = options?.column;
    this.cause = options?.cause;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, WorkspaceConfigError.prototype);
  }

  /**
   * Create error for YAML syntax issues
   */
  static yamlSyntaxError(message: string, line?: number, column?: number, cause?: Error): WorkspaceConfigError {
    const locationInfo =
      line !== undefined ? ` at line ${line}${column !== undefined ? `, column ${column}` : ''}` : '';
    return new WorkspaceConfigError(`Invalid YAML syntax${locationInfo}: ${message}`, {
      line,
      column,
      cause,
    });
  }

  /**
   * Create error for schema validation issues
   */
  static schemaValidationError(fieldPath: string, message: string): WorkspaceConfigError {
    return new WorkspaceConfigError(`Validation error at '${fieldPath}': ${message}`, {
      fieldPath,
    });
  }

  /**
   * Create error for unsupported version
   */
  static unsupportedVersion(version: number): WorkspaceConfigError {
    return new WorkspaceConfigError(`Unsupported workspace config version: ${version}. Only version 1 is supported.`, {
      fieldPath: 'version',
    });
  }

  /**
   * Create error for file access issues
   */
  static fileAccessError(path: string, cause: Error): WorkspaceConfigError {
    return new WorkspaceConfigError(`Cannot read workspace config at '${path}': ${cause.message}`, {
      cause,
    });
  }
}
