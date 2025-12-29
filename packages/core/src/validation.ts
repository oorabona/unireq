/**
 * Validation policy using Adapter Pattern
 */

import { SerializationError } from './errors.js';
import { policy } from './introspection.js';
import type { Policy } from './types.js';

/**
 * Validation adapter interface
 * Adapts any validation library (Zod, Valibot, Joi, etc.) to unireq
 */
export interface ValidationAdapter<TSchema, TOutput> {
  validate(schema: TSchema, data: unknown): Promise<TOutput> | TOutput;
}

/**
 * Validates response data using a schema and an adapter
 * @param schema - The schema to validate against
 * @param adapter - The adapter for the validation library
 * @returns Policy that validates response data
 */
export function validate<TSchema, TOutput>(schema: TSchema, adapter: ValidationAdapter<TSchema, TOutput>): Policy {
  return policy(
    async (ctx, next) => {
      const response = await next(ctx);

      try {
        const validatedData = await adapter.validate(schema, response.data);
        return {
          ...response,
          data: validatedData,
        };
      } catch (error) {
        throw new SerializationError(`Validation failed: ${(error as Error).message}`, error);
      }
    },
    {
      name: 'validate',
      kind: 'other',
      options: { schema },
    },
  );
}
