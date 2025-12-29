/**
 * @unireq/http - HTTP retry predicate tests
 */

import { describe, expect, it } from 'vitest';
import { httpRetryPredicate } from '../http-retry-predicate.js';

describe('@unireq/http - httpRetryPredicate', () => {
  it('should retry retryable status codes', () => {
    const predicate = httpRetryPredicate({ statusCodes: [500, 502, 503] });
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    const result500 = predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctx);
    expect(result500).toBe(true);

    const result502 = predicate({ status: 502, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctx);
    expect(result502).toBe(true);
  });

  it('should not retry non-retryable status codes', () => {
    const predicate = httpRetryPredicate({ statusCodes: [500, 502, 503] });
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    const result404 = predicate(
      { status: 404, statusText: 'Not Found', headers: {}, data: null, ok: false },
      null,
      0,
      ctx,
    );
    expect(result404).toBe(false);

    const result200 = predicate({ status: 200, statusText: 'OK', headers: {}, data: null, ok: true }, null, 0, ctx);
    expect(result200).toBe(false);
  });

  it('should retry retryable methods', () => {
    const predicate = httpRetryPredicate({ methods: ['GET', 'PUT'], statusCodes: [500] });

    const ctxGet = { url: 'https://example.com', method: 'GET', headers: {} };
    const resultGet = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxGet,
    );
    expect(resultGet).toBe(true);

    const ctxPut = { url: 'https://example.com', method: 'PUT', headers: {} };
    const resultPut = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxPut,
    );
    expect(resultPut).toBe(true);
  });

  it('should not retry non-retryable methods', () => {
    const predicate = httpRetryPredicate({ methods: ['GET'], statusCodes: [500] });
    const ctxPost = { url: 'https://example.com', method: 'POST', headers: {} };

    const result = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxPost,
    );
    expect(result).toBe(false);
  });

  it('should retry on network errors for retryable methods', () => {
    const predicate = httpRetryPredicate({ methods: ['GET'] });
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    const result = predicate(null, new Error('Network error'), 0, ctx);
    expect(result).toBe(true);
  });

  it('should not retry on network errors for non-retryable methods', () => {
    const predicate = httpRetryPredicate({ methods: ['GET'] });
    const ctx = { url: 'https://example.com', method: 'POST', headers: {} };

    const result = predicate(null, new Error('Network error'), 0, ctx);
    expect(result).toBe(false);
  });

  it('should respect maxBodySize for responses', () => {
    const predicate = httpRetryPredicate({ methods: ['POST'], statusCodes: [500], maxBodySize: 100 });

    const ctxSmall = { url: 'https://example.com', method: 'POST', headers: {}, body: 'x'.repeat(50) };
    const resultSmall = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxSmall,
    );
    expect(resultSmall).toBe(true);

    const ctxLarge = { url: 'https://example.com', method: 'POST', headers: {}, body: 'x'.repeat(200) };
    const resultLarge = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxLarge,
    );
    expect(resultLarge).toBe(false);
  });

  it('should respect maxBodySize for errors', () => {
    const predicate = httpRetryPredicate({ maxBodySize: 100 });

    const ctxSmall = { url: 'https://example.com', method: 'GET', headers: {}, body: 'x'.repeat(50) };
    const resultSmall = predicate(null, new Error('Network error'), 0, ctxSmall);
    expect(resultSmall).toBe(true);

    const ctxLarge = { url: 'https://example.com', method: 'GET', headers: {}, body: 'x'.repeat(200) };
    const resultLarge = predicate(null, new Error('Network error'), 0, ctxLarge);
    expect(resultLarge).toBe(false);
  });

  it('should handle different body types', () => {
    const predicate = httpRetryPredicate({ methods: ['POST'], statusCodes: [500], maxBodySize: 100 });

    const ctxBlob = { url: 'https://example.com', method: 'POST', headers: {}, body: new Blob(['x'.repeat(200)]) };
    const resultBlob = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxBlob,
    );
    expect(resultBlob).toBe(false);

    const ctxBuffer = { url: 'https://example.com', method: 'POST', headers: {}, body: new ArrayBuffer(200) };
    const resultBuffer = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxBuffer,
    );
    expect(resultBuffer).toBe(false);

    const ctxUint8 = { url: 'https://example.com', method: 'POST', headers: {}, body: new Uint8Array(200) };
    const resultUint8 = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxUint8,
    );
    expect(resultUint8).toBe(false);
  });

  it('should use default retry methods (GET, PUT, DELETE)', () => {
    const predicate = httpRetryPredicate({ statusCodes: [500] });

    const ctxGet = { url: 'https://example.com', method: 'GET', headers: {} };
    expect(predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxGet)).toBe(
      true,
    );

    const ctxPut = { url: 'https://example.com', method: 'PUT', headers: {} };
    expect(predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxPut)).toBe(
      true,
    );

    const ctxDelete = { url: 'https://example.com', method: 'DELETE', headers: {} };
    expect(
      predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxDelete),
    ).toBe(true);

    const ctxPost = { url: 'https://example.com', method: 'POST', headers: {} };
    expect(predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxPost)).toBe(
      false,
    );
  });

  it('should use default retry status codes (408, 429, 500, 502, 503, 504)', () => {
    const predicate = httpRetryPredicate();
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    expect(predicate({ status: 408, statusText: 'Timeout', headers: {}, data: null, ok: false }, null, 0, ctx)).toBe(
      true,
    );
    expect(
      predicate({ status: 429, statusText: 'Too Many Requests', headers: {}, data: null, ok: false }, null, 0, ctx),
    ).toBe(true);
    expect(
      predicate({ status: 500, statusText: 'Internal Server Error', headers: {}, data: null, ok: false }, null, 0, ctx),
    ).toBe(true);
    expect(
      predicate({ status: 502, statusText: 'Bad Gateway', headers: {}, data: null, ok: false }, null, 0, ctx),
    ).toBe(true);
    expect(
      predicate({ status: 503, statusText: 'Service Unavailable', headers: {}, data: null, ok: false }, null, 0, ctx),
    ).toBe(true);
    expect(
      predicate({ status: 504, statusText: 'Gateway Timeout', headers: {}, data: null, ok: false }, null, 0, ctx),
    ).toBe(true);
    expect(predicate({ status: 404, statusText: 'Not Found', headers: {}, data: null, ok: false }, null, 0, ctx)).toBe(
      false,
    );
  });

  it('should handle uppercase method names', () => {
    const predicate = httpRetryPredicate({ methods: ['GET'], statusCodes: [500] });

    const ctxLowercase = { url: 'https://example.com', method: 'get', headers: {} };
    expect(
      predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxLowercase),
    ).toBe(true);

    const ctxUppercase = { url: 'https://example.com', method: 'GET', headers: {} };
    expect(
      predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctxUppercase),
    ).toBe(true);
  });

  it('should return false when both result and error are null', () => {
    const predicate = httpRetryPredicate();
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    const result = predicate(null, null, 0, ctx);
    expect(result).toBe(false);
  });

  it('should not check body size when maxBodySize is undefined', () => {
    const predicate = httpRetryPredicate({ methods: ['POST'], statusCodes: [500] });
    const ctxLarge = { url: 'https://example.com', method: 'POST', headers: {}, body: 'x'.repeat(1000000) };

    const result = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxLarge,
    );
    expect(result).toBe(true);
  });

  it('should handle unknown body types (return 0 size)', () => {
    const predicate = httpRetryPredicate({ methods: ['POST'], statusCodes: [500], maxBodySize: 1000 });
    // Body of unknown type (e.g., number, boolean, object that is not Buffer/ArrayBuffer/View)
    const ctxUnknown = { url: 'https://example.com', method: 'POST', headers: {}, body: { some: 'object' } as any };

    const result = predicate(
      { status: 500, statusText: 'Error', headers: {}, data: null, ok: false },
      null,
      0,
      ctxUnknown,
    );
    // Unknown body type returns 0, which is <= maxBodySize, so retry is allowed
    expect(result).toBe(true);
  });
});
