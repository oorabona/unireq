/**
 * Validation Adapters Example
 * Demonstrates how to implement adapters for Zod and Valibot
 */

import type { ValidationAdapter } from '@unireq/core';
import * as v from 'valibot';
import type { z } from 'zod';

// --- Zod Adapter ---

export class ZodAdapter<T> implements ValidationAdapter<z.ZodType<T>, T> {
  validate(schema: z.ZodType<T>, data: unknown): T {
    return schema.parse(data);
  }
}

// Helper to create adapter instance
export const zodAdapter = <T>() => new ZodAdapter<T>();

// --- Valibot Adapter ---

export class ValibotAdapter<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>
  implements ValidationAdapter<T, v.InferOutput<T>>
{
  async validate(schema: T, data: unknown): Promise<v.InferOutput<T>> {
    const result = await v.parseAsync(schema, data);
    return result;
  }
}

// Helper to create adapter instance
export const valibotAdapter = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>() =>
  new ValibotAdapter<T>();
