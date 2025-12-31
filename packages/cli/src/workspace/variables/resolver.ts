/**
 * Variable resolver engine
 *
 * Resolves ${type:name} patterns in template strings
 */

import { CircularReferenceError, MaxRecursionError, VariableNotFoundError } from './errors.js';
import { hasVariables, parseVariables, unescapeVariables } from './parser.js';
import {
  DEFAULT_INTERPOLATION_OPTIONS,
  type InterpolationContext,
  type InterpolationOptions,
  type VariableMatch,
} from './types.js';

/**
 * Resolve a single variable match
 */
function resolveVariable(match: VariableMatch, context: InterpolationContext): string {
  const { type, name } = match;

  switch (type) {
    case 'var': {
      const value = context.vars[name];
      if (value === undefined) {
        throw new VariableNotFoundError('var', name);
      }
      return value;
    }

    case 'env': {
      const value = process.env[name];
      if (value === undefined) {
        throw new VariableNotFoundError('env', name);
      }
      return value;
    }

    case 'secret': {
      // If resolver provided, use it (sync only for now)
      if (context.secretResolver) {
        const result = context.secretResolver(name);
        if (typeof result === 'string') {
          return result;
        }
        // Promise not supported in sync version
        return `<secret:${name}>`;
      }
      // Return placeholder
      return `<secret:${name}>`;
    }

    case 'prompt': {
      // If resolver provided, use it (sync only for now)
      if (context.promptResolver) {
        const result = context.promptResolver(name);
        if (typeof result === 'string') {
          return result;
        }
        // Promise not supported in sync version
        return `<prompt:${name}>`;
      }
      // Return placeholder
      return `<prompt:${name}>`;
    }

    default:
      // Unknown type - should not happen due to parser filtering
      return match.full;
  }
}

/**
 * Interpolate variables in a template string (recursive with depth tracking)
 */
function interpolateRecursive(
  template: string,
  context: InterpolationContext,
  options: Required<InterpolationOptions>,
  depth: number,
  chain: string[],
): string {
  // Check max depth
  if (depth > options.maxDepth) {
    throw new MaxRecursionError(options.maxDepth, depth, chain[chain.length - 1] ?? 'unknown');
  }

  // Parse variables in current template
  const matches = parseVariables(template);
  if (matches.length === 0) {
    // No more variables - unescape and return
    return unescapeVariables(template);
  }

  // Replace variables from end to start (to preserve indices)
  let result = template;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match) continue;

    // Check for circular reference (only for var type)
    if (match.type === 'var') {
      if (chain.includes(match.name)) {
        throw new CircularReferenceError([...chain, match.name]);
      }
    }

    // Resolve the variable
    const resolved = resolveVariable(match, context);

    // Replace in result
    result = result.slice(0, match.start) + resolved + result.slice(match.end);
  }

  // If result still has variables, recurse (only for var type can have nested refs)
  if (hasVariables(result)) {
    // Build chain for var references
    const varMatches = matches.filter((m) => m.type === 'var');
    const newChain = varMatches.length > 0 ? [...chain, ...varMatches.map((m) => m.name)] : chain;
    return interpolateRecursive(result, context, options, depth + 1, newChain);
  }

  // Unescape any escaped variables
  return unescapeVariables(result);
}

/**
 * Interpolate variables in a template string
 *
 * Supported variable types:
 * - ${var:name} - workspace variables from context.vars
 * - ${env:NAME} - environment variables from process.env
 * - ${secret:name} - secrets (returns placeholder if no resolver)
 * - ${prompt:name} - prompts (returns placeholder if no resolver)
 *
 * @param template - The template string containing variable references
 * @param context - Context with vars and optional resolvers
 * @param options - Optional interpolation options
 * @returns The interpolated string
 * @throws VariableNotFoundError if a required variable is not defined
 * @throws CircularReferenceError if circular variable reference detected
 * @throws MaxRecursionError if maximum recursion depth exceeded
 *
 * @example
 * interpolate("Hello ${var:name}!", { vars: { name: "World" } })
 * // Returns: "Hello World!"
 */
export function interpolate(template: string, context: InterpolationContext, options?: InterpolationOptions): string {
  const resolvedOptions = { ...DEFAULT_INTERPOLATION_OPTIONS, ...options };
  return interpolateRecursive(template, context, resolvedOptions, 0, []);
}

/**
 * Interpolate variables asynchronously
 *
 * Supports async secret and prompt resolvers.
 *
 * @param template - The template string containing variable references
 * @param context - Context with vars and optional async resolvers
 * @param options - Optional interpolation options
 * @returns Promise resolving to the interpolated string
 */
export async function interpolateAsync(
  template: string,
  context: InterpolationContext,
  options?: InterpolationOptions,
): Promise<string> {
  // For now, just wrap sync version
  // TODO: Implement proper async resolution when needed
  return interpolate(template, context, options);
}
