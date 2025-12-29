/**
 * Conditional branching utilities
 */

import { getInspectableMeta, policy as tagPolicy } from './introspection.js';
import type { Policy, Predicate, RequestContext, Response } from './types.js';

/**
 * Creates a policy that executes different policies based on a predicate
 * Useful for conditional execution (e.g., content negotiation)
 *
 * @param predicate - Function that evaluates the condition
 * @param thenPolicy - Policy to execute if predicate is truthy
 * @param elsePolicy - Optional policy to execute if predicate is falsy
 * @returns A policy that branches based on the predicate
 *
 * @example
 * ```ts
 * const contentNegotiation = either(
 *   (ctx) => ctx.headers['accept']?.includes('application/json'),
 *   json(),
 *   xml()
 * );
 * ```
 */
export function either<T = unknown>(predicate: Predicate<T>, thenPolicy: Policy, elsePolicy?: Policy): Policy {
  const impl = async (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => {
    const result = await Promise.resolve(predicate(ctx));

    if (result) {
      return thenPolicy(ctx, next);
    }

    if (elsePolicy) {
      return elsePolicy(ctx, next);
    }

    // If no else branch and predicate is false, pass through
    return next(ctx);
  };

  // Build branch metadata
  const predicateDesc = predicate.name || 'anonymous predicate';
  const thenMetaRaw = getInspectableMeta(thenPolicy);
  const thenMeta = thenMetaRaw ? [thenMetaRaw] : [];
  const elseMetaRaw = elsePolicy ? getInspectableMeta(elsePolicy) : undefined;
  const elseMeta = elseMetaRaw ? [elseMetaRaw] : [];

  return tagPolicy(impl, {
    name: 'either',
    kind: 'other',
    branch: {
      predicate: predicateDesc,
      thenBranch: thenMeta,
      elseBranch: elseMeta,
    },
  });
}

/**
 * Creates a policy that matches against multiple predicates
 * Executes the first matching policy
 *
 * @param branches - Array of predicate-policy pairs
 * @param defaultPolicy - Optional default policy if no predicates match
 * @returns A policy that matches multiple conditions
 *
 * @example
 * ```ts
 * const parser = match(
 *   [
 *     [(ctx) => ctx.headers['content-type']?.includes('json'), json()],
 *     [(ctx) => ctx.headers['content-type']?.includes('xml'), xml()],
 *   ],
 *   text() // default
 * );
 * ```
 */
export function match<T = unknown>(
  branches: ReadonlyArray<readonly [Predicate<T>, Policy]>,
  defaultPolicy?: Policy,
): Policy {
  const impl = async (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => {
    for (const [predicate, policy] of branches) {
      const result = await Promise.resolve(predicate(ctx));
      if (result) {
        return policy(ctx, next);
      }
    }

    if (defaultPolicy) {
      return defaultPolicy(ctx, next);
    }

    return next(ctx);
  };

  // Build children from all branches (match is a composition of either)
  const children = branches.map(([predicate, policy], idx) => {
    const predicateDesc = predicate.name || `branch ${idx + 1}`;
    const meta = getInspectableMeta(policy);
    return {
      id: `match-branch-${idx}`,
      name: predicateDesc,
      kind: 'other' as const,
      children: meta ? [meta] : [],
    };
  });

  if (defaultPolicy) {
    const defaultMeta = getInspectableMeta(defaultPolicy);
    children.push({
      id: 'match-default',
      name: 'default',
      kind: 'other' as const,
      children: defaultMeta ? [defaultMeta] : [],
    });
  }

  return tagPolicy(impl, {
    name: 'match',
    kind: 'other',
    children,
  });
}
