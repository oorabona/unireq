/**
 * Policy introspection utilities
 * Enables inspection of policy composition for debugging and testing
 */

import { randomUUID } from 'node:crypto';
import type { Policy, RequestContext, Response } from './types.js';

/**
 * Policy kind/slot classification
 */
export type Kind =
  | 'transport'
  | 'auth'
  | 'parser'
  | 'headers'
  | 'retry'
  | 'timeout'
  | 'files'
  | 'predicate'
  | 'strategy'
  | 'other';

/**
 * Unified metadata for any inspectable (policy, predicate, strategy, etc.)
 * All inspectable items share this base structure
 */
export interface InspectableMeta {
  /** Unique stable ID for snapshot tests */
  readonly id: string;
  /** Function/object name */
  readonly name: string;
  /** Kind/type classification - unified for all inspectables */
  readonly kind: Kind;
  /** Redacted configuration options */
  readonly options?: Record<string, unknown>;
  /** Child inspectables (for composed functions) */
  readonly children?: ReadonlyArray<InspectableMeta>;
  /** Branch structure (for either/match policies) */
  readonly branch?: {
    readonly predicate: string;
    readonly thenBranch: ReadonlyArray<InspectableMeta>;
    readonly elseBranch: ReadonlyArray<InspectableMeta>;
  };
}

/**
 * Handler type (policy chain result)
 */
export type Handler = (ctx: RequestContext) => Promise<Response>;

/**
 * Symbol for handler graph attachment
 */
export const HANDLER_GRAPH = Symbol('unireq.handlerGraph');

/**
 * Symbol for inspectable metadata attachment
 */
export const INSPECTABLE_META = Symbol('unireq.inspectable');

/**
 * Keys that should be redacted from options (secrets)
 */
const SECRET_KEYS = [
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'clientId',
  'password',
  'privateKey',
  'secret',
  'apiKey',
  'authorization',
] as const;

/**
 * Counter for deterministic IDs in tests
 */
let idCounter = 0;

/**
 * Reset ID counter (for deterministic tests)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Generate stable ID for policy metadata
 */
function generateId(name: string): string {
  // In test mode, use deterministic counter
  if (process.env['NODE_ENV'] === 'test' || process.env['VITEST']) {
    return `${name}#${idCounter++}`;
  }
  // In production, use cryptographically secure random UUID
  return `${name}#${randomUUID().slice(0, 8)}`;
}

/**
 * Deep clones an object while preserving functions and other non-JSON types
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }

  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = deepClone(value);
  }
  return result as T;
}

/**
 * Redacts sensitive options for safe inspection
 * @param opts - Options object to redact
 * @param extraKeys - Additional keys to redact
 * @returns Redacted options clone
 */
export function redactOptions(opts: Record<string, unknown>, extraKeys: string[] = []): Record<string, unknown> {
  if (!opts || typeof opts !== 'object') {
    return {};
  }

  const keys = new Set([...SECRET_KEYS, ...extraKeys]);
  const clone = deepClone(opts);

  for (const key of Object.keys(clone)) {
    if (keys.has(key)) {
      clone[key] = '***redacted***';
    }
    // Also redact nested objects with "secret" in the key name
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
      clone[key] = '***redacted***';
    }
  }

  return clone;
}

/**
 * Type-safe metadata attachment helper
 * Attaches metadata to a function/object via symbol
 */
function attachMetadata<T>(target: T, symbol: symbol, meta: InspectableMeta): void {
  // Use Record<symbol, unknown> to safely index with symbol
  (target as Record<symbol, unknown>)[symbol] = meta;
}

/**
 * Type-safe metadata retrieval helper
 * Retrieves metadata from a function/object via symbol
 */
function getMetadata<T>(target: T, symbol: symbol): InspectableMeta | undefined {
  // Use Record<symbol, unknown> to safely index with symbol
  return (target as Record<symbol, unknown>)[symbol] as InspectableMeta | undefined;
}

/**
 * @frozen Signature change affects 46 files across 8 packages — requires monorepo-wide impact review.
 * Creates a tagged policy with metadata for introspection
 * @param fn - Policy function
 * @param meta - Policy metadata (without id)
 * @returns Tagged policy function
 *
 * @example
 * ```ts
 * export function timeout(ms: number): Policy {
 *   return policy(
 *     async (ctx, next) => {
 *       // ... implementation
 *     },
 *     { name: 'timeout', kind: 'timeout', options: { ms } }
 *   );
 * }
 * ```
 */
export function policy<T extends Policy>(
  fn: T,
  meta: Omit<InspectableMeta, 'id'> & { options?: Record<string, unknown> },
): T {
  const withId: InspectableMeta = {
    ...meta,
    id: generateId(meta.name),
    options: meta.options ? redactOptions(meta.options) : undefined,
  };

  // Attach metadata to function using typed helper
  attachMetadata(fn, INSPECTABLE_META, withId);

  return fn;
}

/**
 * Attaches policy metadata to handler graph
 * @param handler - Handler to attach graph to
 * @param meta - Policy metadata to attach
 */
export function attachToGraph(handler: Handler, meta: InspectableMeta): void {
  const prev = getMetadata(handler, HANDLER_GRAPH) as InspectableMeta[] | undefined;
  const next = prev ? [...prev, meta] : [meta];
  attachMetadata(handler, HANDLER_GRAPH, next as unknown as InspectableMeta);
}

/**
 * Gets handler graph
 * @param handler - Handler to get graph from
 * @returns Policy metadata graph
 */
export function getHandlerGraph(handler: Handler): ReadonlyArray<InspectableMeta> {
  const graph = getMetadata(handler, HANDLER_GRAPH);
  return (graph as unknown as InspectableMeta[]) ?? [];
}

/**
 * Creates an inspectable function/object with metadata
 * Generic version that works with any type of function (predicate, strategy, etc.)
 *
 * @param fn - Function to make inspectable
 * @param meta - Metadata (without id)
 * @returns Tagged function
 *
 * @example
 * ```ts
 * export function backoff(options: BackoffOptions): RetryDelayStrategy {
 *   const strategy = {
 *     getDelay: (result, error, attempt) => { ... }
 *   };
 *   return inspectable(strategy, {
 *     name: 'backoff',
 *     kind: 'strategy',
 *     options: { initial: options.initial, max: options.max }
 *   });
 * }
 * ```
 */
export function inspectable<T>(fn: T, meta: Omit<InspectableMeta, 'id'> & { options?: Record<string, unknown> }): T {
  const withId: InspectableMeta = {
    ...meta,
    id: generateId(meta.name),
    options: meta.options ? redactOptions(meta.options) : undefined,
  };

  // Attach metadata to function/object using typed helper
  attachMetadata(fn, INSPECTABLE_META, withId);

  return fn;
}

/**
 * Extracts inspectable metadata from any function/object
 * @param fn - Function/object to extract metadata from
 * @returns Metadata or undefined if not inspectable
 */
export function getInspectableMeta(fn: unknown): InspectableMeta | undefined {
  if (!fn || (typeof fn !== 'function' && typeof fn !== 'object')) {
    return undefined;
  }
  return getMetadata(fn, INSPECTABLE_META);
}

/**
 * Checks if a function/object has inspectable metadata
 * @param fn - Function/object to check
 * @returns True if inspectable
 */
export function isInspectable(fn: unknown): boolean {
  return getInspectableMeta(fn) !== undefined;
}
