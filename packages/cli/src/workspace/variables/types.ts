/**
 * Variable interpolation types
 */

/**
 * Supported variable types
 */
export type VariableType = 'var' | 'env' | 'secret' | 'prompt';

/**
 * A parsed variable reference from a template string
 */
export interface VariableMatch {
  /** Full match including delimiters, e.g., "${var:name}" */
  full: string;
  /** Variable type: var, env, secret, prompt */
  type: VariableType;
  /** Variable name */
  name: string;
  /** Start position in the template string */
  start: number;
  /** End position in the template string */
  end: number;
}

/**
 * Context for variable interpolation
 */
export interface InterpolationContext {
  /** Workspace variables (from workspace.yaml vars section) */
  vars: Record<string, string>;
  /** Optional resolver for secret variables */
  secretResolver?: (name: string) => string | Promise<string>;
  /** Optional resolver for prompt variables */
  promptResolver?: (name: string) => string | Promise<string>;
}

/**
 * Options for the interpolation function
 */
export interface InterpolationOptions {
  /** Maximum recursion depth (default: 10) */
  maxDepth?: number;
}

/**
 * Default interpolation options
 */
export const DEFAULT_INTERPOLATION_OPTIONS: Required<InterpolationOptions> = {
  maxDepth: 10,
};
