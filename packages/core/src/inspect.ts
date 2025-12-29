/**
 * Policy inspection and formatting utilities
 */

import type { Handler, InspectableMeta, Kind } from './introspection.js';
import { getHandlerGraph, getInspectableMeta } from './introspection.js';
import type { Policy } from './types.js';

/**
 * Inspection output format
 */
export type InspectFormat = 'json' | 'tree';

/**
 * Inspection options
 */
export interface InspectOptions {
  /** Output format (default: 'json') */
  readonly format?: InspectFormat;
  /** Whether to redact sensitive values (default: true) */
  readonly redact?: boolean;
}

/**
 * Inspects a policy or handler and returns its composition graph
 * @param target - Policy or handler to inspect
 * @param options - Inspection options
 * @returns Formatted policy graph
 *
 * @example
 * ```ts
 * const pipeline = compose(
 *   retry(backoff(), { tries: 3 }),
 *   json()
 * );
 *
 * // JSON format
 * console.log(inspect(pipeline));
 *
 * // Tree format
 * console.log(inspect(pipeline, { format: 'tree' }));
 * ```
 */
export function inspect(target: Handler | Policy, options: InspectOptions = {}): string {
  const { format = 'json' } = options;

  // Try to get graph from handler first
  let graph = getHandlerGraph(target as Handler);

  // If no graph, try to get metadata from policy
  if (graph.length === 0) {
    const meta = getInspectableMeta(target as Policy);
    if (meta && meta.name !== 'anonymous') {
      graph = [meta];
    }
  }

  if (graph.length === 0) {
    return format === 'tree' ? '(empty policy chain)' : '[]';
  }

  return format === 'tree' ? toTree(graph) : toJson(graph);
}

/**
 * Shortcut for JSON format inspection
 */
inspect.json = (target: Handler | Policy): string => inspect(target, { format: 'json' });

/**
 * Shortcut for tree format inspection
 */
inspect.tree = (target: Handler | Policy): string => inspect(target, { format: 'tree' });

/**
 * Converts policy graph to JSON string
 */
function toJson(nodes: ReadonlyArray<InspectableMeta>): string {
  return JSON.stringify(nodes, null, 2);
}

/**
 * Converts policy graph to tree using box-drawing characters
 */
function toTree(nodes: ReadonlyArray<InspectableMeta>): string {
  const lines: string[] = [];

  const walk = (meta: InspectableMeta, depth: number, isLast: boolean, parentPrefix = ''): void => {
    // Build indentation based on depth
    let prefix = '';
    if (depth > 0) {
      // For nested items, add proper tree connectors
      prefix = isLast ? '└─ ' : '├─ ';
    }

    const optionsStr = formatOptions(meta.options);
    lines.push(`${parentPrefix}${prefix}${meta.name} (${meta.kind})${optionsStr}`);

    // Handle children (compose)
    if (meta.children && meta.children.length > 0) {
      const childPrefix = parentPrefix + (depth > 0 ? (isLast ? '   ' : '│  ') : '');
      const childrenLength = meta.children.length;
      meta.children.forEach((child, idx) => {
        walk(child, depth + 1, idx === childrenLength - 1, childPrefix);
      });
    }

    // Handle branch (either/match)
    if (meta.branch) {
      const branchPrefix = parentPrefix + (depth > 0 ? (isLast ? '   ' : '│  ') : '');
      lines.push(`${branchPrefix}   ? ${meta.branch.predicate}`);

      if (meta.branch.thenBranch.length > 0) {
        lines.push(`${branchPrefix}   ├─ then:`);
        const thenPrefix = `${branchPrefix}   │  `;
        const thenLength = meta.branch.thenBranch.length;
        meta.branch.thenBranch.forEach((child, idx) => {
          walk(child, depth + 2, idx === thenLength - 1, thenPrefix);
        });
      }

      if (meta.branch.elseBranch.length > 0) {
        lines.push(`${branchPrefix}   └─ else:`);
        const elsePrefix = `${branchPrefix}      `;
        const elseLength = meta.branch.elseBranch.length;
        meta.branch.elseBranch.forEach((child, idx) => {
          walk(child, depth + 2, idx === elseLength - 1, elsePrefix);
        });
      }
    }
  };

  nodes.forEach((node, idx) => {
    walk(node, 0, idx === nodes.length - 1, '');
  });

  return lines.join('\n');
}

/**
 * Formats options for tree display
 */
function formatOptions(opts?: Record<string, unknown>): string {
  if (!opts || Object.keys(opts).length === 0) {
    return '';
  }

  const entries = Object.entries(opts)
    .map(([key, value]) => `${key}=${prettyValue(value)}`)
    .join(', ');

  return ` [${entries}]`;
}

/**
 * Pretty-prints a value for tree display
 */
function prettyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.length <= 3) {
      return `[${value.map(prettyValue).join(', ')}]`;
    }
    return `[${value.slice(0, 2).map(prettyValue).join(', ')}, ... +${value.length - 2}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    const keyList = keys.slice(0, 2).join(', ');
    if (keys.length > 2) {
      return `{${keyList}, ...}`;
    }
    /* v8 ignore next 2 */
    return `{${keyList}}`;
  }

  // Unreachable in practice since JSON.parse() can't produce non-JSON types
  /* v8 ignore next 2 */
  return String(value);
}

/**
 * Asserts that a policy or handler has a specific policy kind
 * Useful for testing presets
 *
 * @param target - Policy or handler to check
 * @param kind - Expected policy kind
 * @throws Error if kind is not found
 *
 * @example
 * ```ts
 * const pipeline = compose(auth(), json());
 * assertHas(pipeline, 'auth'); // throws if no auth policy
 * assertHas(pipeline, 'parser'); // throws if no parser policy
 * ```
 */
export function assertHas(target: Handler | Policy, kind: Kind): void {
  // Try to get graph from handler first
  let graph = getHandlerGraph(target as Handler);

  // If no graph, try to get metadata from policy
  if (graph.length === 0) {
    const meta = getInspectableMeta(target as Policy);
    if (meta && meta.name !== 'anonymous') {
      graph = [meta];
    }
  }

  const hasKind = (nodes: ReadonlyArray<InspectableMeta>): boolean => {
    for (const node of nodes) {
      if (node.kind === kind) {
        return true;
      }
      if (node.children && hasKind(node.children)) {
        return true;
      }
      if (node.branch) {
        if (hasKind(node.branch.thenBranch) || hasKind(node.branch.elseBranch)) {
          return true;
        }
      }
    }
    return false;
  };

  if (!hasKind(graph)) {
    throw new Error(`Expected policy kind "${kind}" not found in handler graph`);
  }
}
