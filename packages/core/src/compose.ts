/**
 * Policy composition utilities
 */

import type { InspectableMeta } from './introspection.js';
import { getInspectableMeta, policy as tagPolicy } from './introspection.js';
import type { Policy, RequestContext, Response } from './types.js';

/**
 * Composes multiple policies into a single policy chain (onion model)
 * @param policies - Array of policies to compose
 * @returns A single composed policy
 */
export function compose(...policies: ReadonlyArray<Policy>): Policy {
  if (policies.length === 0) {
    return async (_ctx, next) => next(_ctx);
  }

  if (policies.length === 1) {
    const singlePolicy = policies[0];
    if (!singlePolicy) {
      return async (_ctx, next) => next(_ctx);
    }
    return singlePolicy;
  }

  const impl = async (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => {
    const dispatch = async (i: number, context: RequestContext): Promise<Response> => {
      const policy = policies[i];
      if (!policy) {
        return next(context);
      }

      return policy(context, (nextCtx) => dispatch(i + 1, nextCtx));
    };

    return dispatch(0, ctx);
  };

  // Build children metadata from input policies (filter out undefined)
  const children: InspectableMeta[] = policies
    .filter((p) => p !== undefined)
    .map((p) => getInspectableMeta(p))
    .filter((m): m is InspectableMeta => m !== undefined);

  return tagPolicy(impl, {
    name: 'compose',
    kind: 'other',
    children,
  });
}
