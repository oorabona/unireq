/**
 * @unireq/core - Retry introspection tests
 * Tests that predicates and delay strategies are introspectable
 */

import { describe, expect, it } from 'vitest';
import { backoff } from '../backoff.js';
import { getInspectableMeta, INSPECTABLE_META, inspectable, isInspectable, resetIdCounter } from '../introspection.js';
import { type RetryDelayStrategy, type RetryPredicate, retry } from '../retry.js';
import type { Response } from '../types.js';

describe('@unireq/core - retry introspection', () => {
  it('should make backoff strategy inspectable', () => {
    resetIdCounter();
    const strategy = backoff({ initial: 100, max: 1000, multiplier: 2, jitter: false });

    expect(isInspectable(strategy)).toBe(true);

    const meta = getInspectableMeta(strategy);
    expect(meta).toEqual({
      id: 'backoff#0',
      name: 'backoff',
      kind: 'strategy',
      options: {
        initial: 100,
        max: 1000,
        multiplier: 2,
        jitter: false,
      },
    });
  });

  it('should make custom predicate inspectable', () => {
    resetIdCounter();

    const predicate: RetryPredicate = (result, error) => {
      return error !== null || (result as any)?.status >= 500;
    };

    const inspectablePredicate = inspectable(predicate, {
      name: 'customPredicate',
      kind: 'predicate',
      options: { statusCodes: [500, 502, 503] },
    });

    expect(isInspectable(inspectablePredicate)).toBe(true);

    const meta = getInspectableMeta(inspectablePredicate);
    expect(meta).toEqual({
      id: 'customPredicate#0',
      name: 'customPredicate',
      kind: 'predicate',
      options: {
        statusCodes: [500, 502, 503],
      },
    });
  });

  it('should make custom strategy inspectable', () => {
    resetIdCounter();

    const strategy: RetryDelayStrategy = {
      getDelay: (_result, _error, attempt) => {
        return 1000 * (attempt + 1);
      },
    };

    const inspectableStrategy = inspectable(strategy, {
      name: 'linearBackoff',
      kind: 'strategy',
      options: { base: 1000 },
    });

    expect(isInspectable(inspectableStrategy)).toBe(true);

    const meta = getInspectableMeta(inspectableStrategy);
    expect(meta).toEqual({
      id: 'linearBackoff#0',
      name: 'linearBackoff',
      kind: 'strategy',
      options: {
        base: 1000,
      },
    });
  });

  it('should include predicate and strategies in retry policy metadata', () => {
    resetIdCounter();

    const predicate: RetryPredicate<Response> = inspectable(
      (result, error) => error !== null || (result?.status ?? 0) >= 500,
      {
        name: 'serverErrorPredicate',
        kind: 'predicate',
        options: { statusCodes: [500, 502, 503] },
      },
    );

    const strategy1 = backoff({ initial: 100, max: 1000 });
    const strategy2 = inspectable(
      {
        getDelay: () => 500,
      } as RetryDelayStrategy,
      {
        name: 'fixedDelay',
        kind: 'strategy',
        options: { delay: 500 },
      },
    );

    const policy = retry(predicate, [strategy1, strategy2], { tries: 3 });

    const policyMeta = (policy as any)[INSPECTABLE_META];
    expect(policyMeta).toBeDefined();
    expect(policyMeta.name).toBe('retry');
    expect(policyMeta.kind).toBe('retry');
    expect(policyMeta.options).toEqual({ tries: 3 });

    expect(policyMeta.children).toBeDefined();
    expect(policyMeta.children).toHaveLength(3); // 1 predicate + 2 strategies

    // Check predicate metadata
    expect(policyMeta.children[0]).toEqual({
      id: 'serverErrorPredicate#0',
      name: 'serverErrorPredicate',
      kind: 'predicate',
      options: { statusCodes: [500, 502, 503] },
    });

    // Check first strategy metadata
    expect(policyMeta.children[1].name).toBe('backoff');
    expect(policyMeta.children[1].kind).toBe('strategy');
    expect(policyMeta.children[1].options).toEqual({
      initial: 100,
      max: 1000,
      multiplier: 2,
      jitter: true,
    });

    // Check second strategy metadata
    expect(policyMeta.children[2]).toEqual({
      id: 'fixedDelay#2',
      name: 'fixedDelay',
      kind: 'strategy',
      options: { delay: 500 },
    });
  });

  it('should handle retry with non-inspectable predicate/strategies', () => {
    resetIdCounter();

    // Plain functions without metadata
    const plainPredicate = () => true;
    const plainStrategy = { getDelay: () => 100 };

    const policy = retry(plainPredicate, [plainStrategy], { tries: 2 });

    const policyMeta = (policy as any)[INSPECTABLE_META];
    expect(policyMeta).toBeDefined();
    expect(policyMeta.name).toBe('retry');
    expect(policyMeta.children).toEqual([]); // No inspectable children
  });

  it('should handle retry with mix of inspectable and non-inspectable', () => {
    resetIdCounter();

    const inspectablePredicate = inspectable(() => true, {
      name: 'alwaysRetry',
      kind: 'predicate',
    });

    const plainStrategy = { getDelay: () => 100 };
    const inspectableStrategy = backoff({ initial: 200 });

    const policy = retry(inspectablePredicate, [plainStrategy, inspectableStrategy], { tries: 3 });

    const policyMeta = (policy as any)[INSPECTABLE_META];
    expect(policyMeta.children).toHaveLength(2); // 1 predicate + 1 inspectable strategy

    expect(policyMeta.children[0].name).toBe('alwaysRetry');
    expect(policyMeta.children[1].name).toBe('backoff');
  });

  it('should return undefined for non-inspectable objects', () => {
    const plainFunction = () => {};
    const plainObject = { foo: 'bar' };

    expect(getInspectableMeta(plainFunction)).toBeUndefined();
    expect(getInspectableMeta(plainObject)).toBeUndefined();
    expect(getInspectableMeta(null)).toBeUndefined();
    expect(getInspectableMeta(undefined)).toBeUndefined();
    expect(getInspectableMeta(42)).toBeUndefined();
    expect(getInspectableMeta('string')).toBeUndefined();
  });

  it('should preserve inspectable metadata through composition', () => {
    resetIdCounter();

    const strategy = backoff({ initial: 100, max: 1000 });
    const meta1 = getInspectableMeta(strategy);

    // Metadata should be stable
    const meta2 = getInspectableMeta(strategy);
    expect(meta1).toBe(meta2);
    expect(meta1).toEqual(meta2);
  });
});
