/**
 * @unireq/core - Validation policy tests
 */

import { describe, expect, it } from 'vitest';
import { SerializationError } from '../errors.js';
import type { RequestContext, Response } from '../types.js';
import type { ValidationAdapter } from '../validation.js';
import { validate } from '../validation.js';

describe('@unireq/core - validate', () => {
  // Simple mock adapter
  const mockAdapter: ValidationAdapter<any, any> = {
    validate: (schema, data) => {
      if (schema === 'string' && typeof data !== 'string') {
        throw new Error('Expected string');
      }
      if (schema === 'number' && typeof data !== 'number') {
        throw new Error('Expected number');
      }
      return data;
    },
  };

  const mockNext = async (data: any): Promise<Response> => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data,
    ok: true,
  });

  const mockContext: RequestContext = {
    url: 'https://example.com',
    method: 'GET',
    headers: {},
  };

  it('should pass valid data', async () => {
    const policy = validate('string', mockAdapter);
    const response = await policy(mockContext, () => mockNext('hello'));

    expect(response.data).toBe('hello');
  });

  it('should throw SerializationError on validation failure', async () => {
    const policy = validate('number', mockAdapter);

    await expect(policy(mockContext, () => mockNext('hello'))).rejects.toThrow(SerializationError);

    await expect(policy(mockContext, () => mockNext('hello'))).rejects.toThrow('Validation failed: Expected number');
  });

  it('should support async validation', async () => {
    const asyncAdapter: ValidationAdapter<any, any> = {
      validate: async (_schema, data) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return data;
      },
    };

    const policy = validate('any', asyncAdapter);
    const response = await policy(mockContext, () => mockNext('hello'));

    expect(response.data).toBe('hello');
  });

  it('should transform data if adapter returns new value', async () => {
    const transformAdapter: ValidationAdapter<any, any> = {
      validate: (_schema, data) => `${data} world`,
    };

    const policy = validate('any', transformAdapter);
    const response = await policy(mockContext, () => mockNext('hello'));

    expect(response.data).toBe('hello world');
  });
});
