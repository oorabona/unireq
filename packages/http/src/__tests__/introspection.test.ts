/**
 * @unireq/http - HTTP introspection tests
 * Tests that HTTP predicates and strategies are introspectable
 */

import { getInspectableMeta, isInspectable, resetIdCounter } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { httpRetryPredicate } from '../http-retry-predicate.js';
import { rateLimitDelay } from '../ratelimit.js';

describe('@unireq/http - introspection', () => {
  it('should make httpRetryPredicate inspectable', () => {
    resetIdCounter();

    const predicate = httpRetryPredicate({
      methods: ['GET', 'POST'],
      statusCodes: [500, 502, 503],
      maxBodySize: 1024,
    });

    expect(isInspectable(predicate)).toBe(true);

    const meta = getInspectableMeta(predicate);
    expect(meta).toEqual({
      id: 'httpRetryPredicate#0',
      name: 'httpRetryPredicate',
      kind: 'predicate',
      options: {
        methods: ['GET', 'POST'],
        statusCodes: [500, 502, 503],
        maxBodySize: 1024,
      },
    });
  });

  it('should make httpRetryPredicate with defaults inspectable', () => {
    resetIdCounter();

    const predicate = httpRetryPredicate();

    expect(isInspectable(predicate)).toBe(true);

    const meta = getInspectableMeta(predicate);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe('httpRetryPredicate');
    expect(meta?.kind).toBe('predicate');
    expect(meta?.options).toHaveProperty('methods');
    expect(meta?.options).toHaveProperty('statusCodes');
  });

  it('should make rateLimitDelay inspectable', () => {
    resetIdCounter();

    const strategy = rateLimitDelay({ maxWait: 30000 });

    expect(isInspectable(strategy)).toBe(true);

    const meta = getInspectableMeta(strategy);
    expect(meta).toEqual({
      id: 'rateLimitDelay#0',
      name: 'rateLimitDelay',
      kind: 'strategy',
      options: {
        maxWait: 30000,
      },
    });
  });

  it('should make rateLimitDelay with defaults inspectable', () => {
    resetIdCounter();

    const strategy = rateLimitDelay();

    expect(isInspectable(strategy)).toBe(true);

    const meta = getInspectableMeta(strategy);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe('rateLimitDelay');
    expect(meta?.kind).toBe('strategy');
    expect(meta?.options).toHaveProperty('maxWait');
  });

  it('should preserve functionality after making inspectable', () => {
    const predicate = httpRetryPredicate({ statusCodes: [500] });
    const ctx = { url: 'https://example.com', method: 'GET', headers: {} };

    // Predicate should still work
    const result500 = predicate({ status: 500, statusText: 'Error', headers: {}, data: null, ok: false }, null, 0, ctx);
    expect(result500).toBe(true);

    const result200 = predicate({ status: 200, statusText: 'OK', headers: {}, data: null, ok: true }, null, 0, ctx);
    expect(result200).toBe(false);
  });

  it('should preserve strategy functionality after making inspectable', async () => {
    const strategy = rateLimitDelay({ maxWait: 5000 });

    // Strategy should still work
    const delay = await strategy.getDelay(
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '2' },
        data: null,
        ok: false,
      },
      null,
      0,
    );

    expect(delay).toBe(2000); // 2 seconds
  });
});
