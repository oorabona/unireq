/**
 * Variable interpolation errors
 */

/**
 * Base error class for variable interpolation errors
 */
export class VariableError extends Error {
  /** Variable name that caused the error */
  readonly variableName: string;
  /** Variable type (var, env, secret, prompt) */
  readonly variableType: string;

  constructor(
    message: string,
    options: {
      variableName: string;
      variableType: string;
    },
  ) {
    super(message);
    this.name = 'VariableError';
    this.variableName = options.variableName;
    this.variableType = options.variableType;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a variable is not found
 */
export class VariableNotFoundError extends VariableError {
  constructor(variableType: string, variableName: string) {
    const typeLabel = variableType === 'env' ? 'Environment variable' : `Variable`;
    const message =
      variableType === 'env'
        ? `${typeLabel} '${variableName}' is not defined`
        : `${typeLabel} '${variableName}' not found in ${variableType}s`;
    super(message, { variableName, variableType });
    this.name = 'VariableNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when circular reference is detected
 */
export class CircularReferenceError extends VariableError {
  /** The resolution chain that led to the circular reference */
  readonly chain: string[];

  constructor(chain: string[]) {
    const chainStr = chain.join(' → ');
    super(`Circular reference detected: ${chainStr}`, {
      variableName: chain[chain.length - 1] ?? '',
      variableType: 'var',
    });
    this.name = 'CircularReferenceError';
    this.chain = chain;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when maximum recursion depth is exceeded
 */
export class MaxRecursionError extends VariableError {
  /** The maximum depth that was exceeded */
  readonly maxDepth: number;
  /** The current depth when the error occurred */
  readonly currentDepth: number;

  constructor(maxDepth: number, currentDepth: number, variableName: string) {
    super(`Maximum recursion depth (${maxDepth}) exceeded while resolving variable '${variableName}'`, {
      variableName,
      variableType: 'var',
    });
    this.name = 'MaxRecursionError';
    this.maxDepth = maxDepth;
    this.currentDepth = currentDepth;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
