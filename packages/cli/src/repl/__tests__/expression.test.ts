/**
 * Tests for expression evaluator
 */

import { describe, expect, it } from 'vitest';
import {
  createResponseContext,
  evaluateExpression,
  InvalidExpressionError,
  isUnderscoreExpression,
  NoResponseError,
  PathNotFoundError,
  type ResponseContext,
  valueToString,
} from '../expression.js';

describe('isUnderscoreExpression', () => {
  it('returns true for bare _', () => {
    expect(isUnderscoreExpression('_')).toBe(true);
  });

  it('returns true for _.property', () => {
    expect(isUnderscoreExpression('_.status')).toBe(true);
    expect(isUnderscoreExpression('_.body.data')).toBe(true);
  });

  it('returns true with whitespace', () => {
    expect(isUnderscoreExpression('  _  ')).toBe(true);
    expect(isUnderscoreExpression('  _.status  ')).toBe(true);
  });

  it('returns false for non-underscore expressions', () => {
    expect(isUnderscoreExpression('status')).toBe(false);
    expect(isUnderscoreExpression('$')).toBe(false);
    expect(isUnderscoreExpression('hello')).toBe(false);
    expect(isUnderscoreExpression('')).toBe(false);
  });
});

describe('valueToString', () => {
  it('converts null to "null"', () => {
    expect(valueToString(null)).toBe('null');
  });

  it('converts undefined to "undefined"', () => {
    expect(valueToString(undefined)).toBe('undefined');
  });

  it('returns strings as-is', () => {
    expect(valueToString('hello')).toBe('hello');
    expect(valueToString('')).toBe('');
  });

  it('converts numbers to string', () => {
    expect(valueToString(200)).toBe('200');
    expect(valueToString(3.14)).toBe('3.14');
  });

  it('converts booleans to string', () => {
    expect(valueToString(true)).toBe('true');
    expect(valueToString(false)).toBe('false');
  });

  it('JSON stringifies objects', () => {
    const result = valueToString({ a: 1 });
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it('JSON stringifies arrays', () => {
    const result = valueToString([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });
});

describe('evaluateExpression', () => {
  const baseContext: ResponseContext = {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': 'abc123',
    },
    body: JSON.stringify({ data: [{ id: 1, name: 'Alice' }], total: 1 }),
    timing: {
      total: 150,
      dns: 10,
      tcp: 20,
      tls: 30,
      ttfb: 50,
      download: 40,
      startTime: 1000,
      endTime: 1150,
    },
  };

  describe('error handling', () => {
    it('throws NoResponseError when no response context', () => {
      const emptyCtx: ResponseContext = {};
      expect(() => evaluateExpression('_.status', emptyCtx)).toThrow(NoResponseError);
      expect(() => evaluateExpression('_.status', emptyCtx)).toThrow(
        'No response available. Execute a request first.',
      );
    });

    it('throws InvalidExpressionError for non-underscore expressions', () => {
      expect(() => evaluateExpression('status', baseContext)).toThrow(InvalidExpressionError);
      expect(() => evaluateExpression('$', baseContext)).toThrow(InvalidExpressionError);
    });

    it('throws InvalidExpressionError for empty path after _.', () => {
      expect(() => evaluateExpression('_.', baseContext)).toThrow(InvalidExpressionError);
    });

    it('throws InvalidExpressionError for unknown top-level property', () => {
      expect(() => evaluateExpression('_.unknown', baseContext)).toThrow(InvalidExpressionError);
      expect(() => evaluateExpression('_.unknown', baseContext)).toThrow(/Unknown property "unknown"/);
    });
  });

  describe('_.status', () => {
    it('returns status code', () => {
      expect(evaluateExpression('_.status', baseContext)).toBe(200);
    });

    it('throws when trying to access property on status', () => {
      expect(() => evaluateExpression('_.status.code', baseContext)).toThrow(InvalidExpressionError);
    });
  });

  describe('_.statusText', () => {
    it('returns status text', () => {
      expect(evaluateExpression('_.statusText', baseContext)).toBe('OK');
    });

    it('throws when trying to access property on statusText', () => {
      expect(() => evaluateExpression('_.statusText.length', baseContext)).toThrow(InvalidExpressionError);
    });
  });

  describe('_.headers', () => {
    it('returns all headers', () => {
      const result = evaluateExpression('_.headers', baseContext);
      expect(result).toEqual({
        'Content-Type': 'application/json',
        'X-Request-Id': 'abc123',
      });
    });

    it('returns specific header (case-insensitive)', () => {
      expect(evaluateExpression('_.headers.Content-Type', baseContext)).toBe('application/json');
      expect(evaluateExpression('_.headers.content-type', baseContext)).toBe('application/json');
      expect(evaluateExpression('_.headers.CONTENT-TYPE', baseContext)).toBe('application/json');
    });

    it('returns empty string for missing header', () => {
      expect(evaluateExpression('_.headers.X-Missing', baseContext)).toBe('');
    });

    it('returns empty object when no headers', () => {
      const noHeaders: ResponseContext = { ...baseContext, headers: undefined };
      expect(evaluateExpression('_.headers', noHeaders)).toEqual({});
    });
  });

  describe('_.body', () => {
    it('returns parsed JSON body', () => {
      const result = evaluateExpression('_.body', baseContext);
      expect(result).toEqual({ data: [{ id: 1, name: 'Alice' }], total: 1 });
    });

    it('returns string for non-JSON body', () => {
      const textCtx: ResponseContext = { ...baseContext, body: 'plain text' };
      expect(evaluateExpression('_.body', textCtx)).toBe('plain text');
    });

    it('extracts nested path with JSONPath', () => {
      expect(evaluateExpression('_.body.data', baseContext)).toEqual([{ id: 1, name: 'Alice' }]);
      expect(evaluateExpression('_.body.data[0]', baseContext)).toEqual({ id: 1, name: 'Alice' });
      expect(evaluateExpression('_.body.data[0].id', baseContext)).toBe(1);
      expect(evaluateExpression('_.body.data[0].name', baseContext)).toBe('Alice');
      expect(evaluateExpression('_.body.total', baseContext)).toBe(1);
    });

    it('throws PathNotFoundError for missing path', () => {
      expect(() => evaluateExpression('_.body.missing', baseContext)).toThrow(PathNotFoundError);
      expect(() => evaluateExpression('_.body.data[99]', baseContext)).toThrow(PathNotFoundError);
    });

    it('throws InvalidExpressionError when extracting path from non-JSON body', () => {
      const textCtx: ResponseContext = { ...baseContext, body: 'plain text' };
      expect(() => evaluateExpression('_.body.path', textCtx)).toThrow(InvalidExpressionError);
      expect(() => evaluateExpression('_.body.path', textCtx)).toThrow(/Cannot extract path from non-JSON body/);
    });

    it('handles empty body', () => {
      const emptyCtx: ResponseContext = { ...baseContext, body: '' };
      expect(evaluateExpression('_.body', emptyCtx)).toBe('');
    });
  });

  describe('_.timing', () => {
    it('returns full timing object', () => {
      const result = evaluateExpression('_.timing', baseContext);
      expect(result).toEqual({
        total: 150,
        dns: 10,
        tcp: 20,
        tls: 30,
        ttfb: 50,
        download: 40,
        startTime: 1000,
        endTime: 1150,
      });
    });

    it('returns specific timing value', () => {
      expect(evaluateExpression('_.timing.total', baseContext)).toBe(150);
      expect(evaluateExpression('_.timing.dns', baseContext)).toBe(10);
      expect(evaluateExpression('_.timing.ttfb', baseContext)).toBe(50);
    });

    it('throws PathNotFoundError for missing timing property', () => {
      expect(() => evaluateExpression('_.timing.invalid', baseContext)).toThrow(PathNotFoundError);
    });

    it('throws PathNotFoundError when no timing available', () => {
      const noTiming: ResponseContext = { ...baseContext, timing: undefined };
      expect(() => evaluateExpression('_.timing.total', noTiming)).toThrow(PathNotFoundError);
    });

    it('returns undefined for _.timing when no timing', () => {
      const noTiming: ResponseContext = { ...baseContext, timing: undefined };
      expect(evaluateExpression('_.timing', noTiming)).toBeUndefined();
    });
  });

  describe('bare _', () => {
    it('returns full response object', () => {
      const result = evaluateExpression('_', baseContext) as Record<string, unknown>;
      expect(result['status']).toBe(200);
      expect(result['statusText']).toBe('OK');
      expect(result['headers']).toEqual(baseContext.headers);
      expect(result['body']).toEqual({ data: [{ id: 1, name: 'Alice' }], total: 1 });
      expect(result['timing']).toEqual(baseContext.timing);
    });
  });

  describe('whitespace handling', () => {
    it('trims whitespace from expression', () => {
      expect(evaluateExpression('  _.status  ', baseContext)).toBe(200);
      expect(evaluateExpression('\t_.body.total\n', baseContext)).toBe(1);
    });
  });
});

describe('createResponseContext', () => {
  it('creates context from ReplState fields', () => {
    const state = {
      lastResponseStatus: 201,
      lastResponseStatusText: 'Created',
      lastResponseHeaders: { 'Location': '/new' },
      lastResponseBody: '{"id":42}',
      lastResponseTiming: { total: 100 } as any,
    };

    const ctx = createResponseContext(state);

    expect(ctx.status).toBe(201);
    expect(ctx.statusText).toBe('Created');
    expect(ctx.headers).toEqual({ Location: '/new' });
    expect(ctx.body).toBe('{"id":42}');
    expect(ctx.timing?.total).toBe(100);
  });

  it('handles undefined fields', () => {
    const state = {};
    const ctx = createResponseContext(state);

    expect(ctx.status).toBeUndefined();
    expect(ctx.statusText).toBeUndefined();
    expect(ctx.headers).toBeUndefined();
    expect(ctx.body).toBeUndefined();
    expect(ctx.timing).toBeUndefined();
  });
});
