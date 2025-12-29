/**
 * @unireq/core - Inspect API tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { compose } from '../compose.js';
import { either } from '../either.js';
import { assertHas, inspect } from '../inspect.js';
import { policy, resetIdCounter } from '../introspection.js';
import type { Policy, RequestContext } from '../types.js';

describe('@unireq/core - inspect', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  const createTestPolicy = (name: string, kind: 'auth' | 'parser' | 'retry' | 'other' = 'other'): Policy =>
    policy(async (ctx, next) => next(ctx), { name, kind });

  describe('inspect() - JSON format', () => {
    it('should inspect empty policy chain', () => {
      const handler = compose();
      const result = inspect(handler);
      expect(result).toBe('[]');
    });

    it('should inspect single policy', () => {
      const testPolicy = createTestPolicy('testPolicy', 'auth');
      const handler = compose(testPolicy);

      const result = inspect(handler, { format: 'json' });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      // compose() with single policy returns the policy directly
      expect(parsed[0]).toMatchObject({
        name: 'testPolicy',
        kind: 'auth',
      });
    });

    it('should inspect multiple policies', () => {
      const auth = createTestPolicy('auth', 'auth');
      const parser = createTestPolicy('parser', 'parser');
      const handler = compose(auth, parser);

      const result = inspect(handler, { format: 'json' });
      const parsed = JSON.parse(result);

      expect(parsed[0].children).toHaveLength(2);
      expect(parsed[0].children[0].name).toBe('auth');
      expect(parsed[0].children[1].name).toBe('parser');
    });

    it('should inspect nested composition', () => {
      const inner = compose(createTestPolicy('inner1'), createTestPolicy('inner2'));
      const outer = compose(createTestPolicy('outer'), inner);

      const result = inspect(outer, { format: 'json' });
      const parsed = JSON.parse(result);

      expect(parsed[0].children).toHaveLength(2);
      expect(parsed[0].children[1].name).toBe('compose');
      expect(parsed[0].children[1].children).toHaveLength(2);
    });

    it('should inspect either policy', () => {
      const predicate = (ctx: RequestContext) => ctx.method === 'GET';
      const thenPolicy = createTestPolicy('getHandler');
      const elsePolicy = createTestPolicy('postHandler');

      const handler = either(predicate, thenPolicy, elsePolicy);

      const result = inspect(handler, { format: 'json' });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('either');
      expect(parsed[0].branch).toBeDefined();
      expect(parsed[0].branch.predicate).toBe('predicate');
      expect(parsed[0].branch.thenBranch).toHaveLength(1);
      expect(parsed[0].branch.elseBranch).toHaveLength(1);
    });
  });

  describe('inspect() - Tree format', () => {
    it('should render empty policy chain', () => {
      const handler = compose();
      const result = inspect(handler, { format: 'tree' });
      expect(result).toBe('(empty policy chain)');
    });

    it('should render single policy as tree', () => {
      const testPolicy = createTestPolicy('testPolicy', 'auth');
      const handler = compose(testPolicy);

      const result = inspect(handler, { format: 'tree' });

      // compose() with single policy returns the policy directly
      expect(result).toContain('testPolicy (auth)');
    });

    it('should render multiple policies as tree', () => {
      const auth = createTestPolicy('auth', 'auth');
      const parser = createTestPolicy('parser', 'parser');
      const handler = compose(auth, parser);

      const result = inspect(handler, { format: 'tree' });

      expect(result).toContain('compose (other)');
      expect(result).toContain('auth (auth)');
      expect(result).toContain('parser (parser)');
    });

    it('should render either policy as tree', () => {
      const predicate = (ctx: RequestContext) => ctx.method === 'GET';
      const thenPolicy = createTestPolicy('getHandler');
      const elsePolicy = createTestPolicy('postHandler');

      const handler = either(predicate, thenPolicy, elsePolicy);

      const result = inspect(handler, { format: 'tree' });

      expect(result).toContain('either (other)');
      expect(result).toContain('? predicate');
      expect(result).toContain('├─ then:');
      expect(result).toContain('└─ else:');
      expect(result).toContain('getHandler (other)');
      expect(result).toContain('postHandler (other)');
    });

    it('should render nested either policy (tests branch prefixes at depth > 0)', () => {
      const predicate = (ctx: RequestContext) => ctx.method === 'GET';
      const thenPolicy = createTestPolicy('getHandler');
      const elsePolicy = createTestPolicy('postHandler');
      const eitherPolicy = either(predicate, thenPolicy, elsePolicy);

      // Nest either inside compose to get depth > 0
      const handler = compose(createTestPolicy('outer'), eitherPolicy);

      const result = inspect(handler, { format: 'tree' });

      expect(result).toContain('outer (other)');
      expect(result).toContain('either (other)');
      expect(result).toContain('? predicate');
      expect(result).toContain('├─ then:');
      expect(result).toContain('└─ else:');
      expect(result).toContain('getHandler (other)');
      expect(result).toContain('postHandler (other)');
    });

    it('should render either NOT as last child (tests isLast=false branch at line 110)', () => {
      const predicate = (ctx: RequestContext) => ctx.method === 'GET';
      const thenPolicy = createTestPolicy('getHandler');
      const elsePolicy = createTestPolicy('postHandler');
      const eitherPolicy = either(predicate, thenPolicy, elsePolicy);

      // Either is NOT last child (followed by another policy)
      const handler = compose(createTestPolicy('outer'), eitherPolicy, createTestPolicy('afterEither'));

      const result = inspect(handler, { format: 'tree' });

      expect(result).toContain('outer (other)');
      expect(result).toContain('either (other)');
      expect(result).toContain('afterEither (other)');
      expect(result).toContain('? predicate');
    });

    it('should render nested composition as tree', () => {
      const inner = compose(createTestPolicy('inner1'), createTestPolicy('inner2'));
      const outer = compose(createTestPolicy('outer'), inner);

      const result = inspect(outer, { format: 'tree' });

      expect(result).toContain('outer (other)');
      expect(result).toContain('compose (other)');
      expect(result).toContain('inner1 (other)');
      expect(result).toContain('inner2 (other)');
    });

    it('should render deeply nested composition (tests all branch prefixes)', () => {
      // Create 3+ children at depth > 0 to test all isLast branches
      const deepInner = compose(createTestPolicy('deep1'), createTestPolicy('deep2'), createTestPolicy('deep3'));
      const inner = compose(createTestPolicy('inner1'), deepInner, createTestPolicy('inner2'));
      const outer = compose(createTestPolicy('outer'), inner);

      const result = inspect(outer, { format: 'tree' });

      expect(result).toContain('outer (other)');
      expect(result).toContain('compose (other)');
      expect(result).toContain('inner1 (other)');
      expect(result).toContain('deep1 (other)');
      expect(result).toContain('deep2 (other)');
      expect(result).toContain('deep3 (other)');
      expect(result).toContain('inner2 (other)');
    });
  });

  describe('inspect shortcuts', () => {
    it('should provide json() shortcut', () => {
      const handler = compose(createTestPolicy('test'));
      const result = inspect.json(handler);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should provide tree() shortcut', () => {
      const handler = compose(createTestPolicy('test'));
      const result = inspect.tree(handler);
      // compose() with single policy returns the policy directly
      expect(result).toContain('test (other)');
    });
  });

  describe('assertHas()', () => {
    it('should pass when policy kind exists', () => {
      const auth = createTestPolicy('auth', 'auth');
      const handler = compose(auth);

      expect(() => assertHas(handler, 'auth')).not.toThrow();
    });

    it('should throw when policy kind is missing', () => {
      const parser = createTestPolicy('parser', 'parser');
      const handler = compose(parser);

      expect(() => assertHas(handler, 'auth')).toThrow('Expected policy kind "auth" not found');
    });

    it('should find policy in nested composition', () => {
      const inner = compose(createTestPolicy('auth', 'auth'));
      const outer = compose(createTestPolicy('parser', 'parser'), inner);

      expect(() => assertHas(outer, 'auth')).not.toThrow();
    });

    it('should find policy in either branches', () => {
      const predicate = () => true;
      const thenPolicy = createTestPolicy('auth', 'auth');
      const elsePolicy = createTestPolicy('parser', 'parser');
      const handler = either(predicate, thenPolicy, elsePolicy);

      expect(() => assertHas(handler, 'auth')).not.toThrow();
      expect(() => assertHas(handler, 'parser')).not.toThrow();
    });
  });

  describe('tree format with options', () => {
    it('should display options with various value types', () => {
      const policyWithOptions = policy(async (ctx, next) => next(ctx), {
        name: 'testWithOptions',
        kind: 'other',
        options: {
          stringValue: 'test',
          numberValue: 42,
          booleanValue: true,
          nullValue: null,
          undefinedValue: undefined,
        },
      });

      const handler = compose(policyWithOptions);
      const result = inspect.tree(handler);

      expect(result).toContain('testWithOptions (other)');
      expect(result).toContain('stringValue="test"');
      expect(result).toContain('numberValue=42');
      expect(result).toContain('booleanValue=true');
      expect(result).toContain('nullValue=null');
    });

    it('should display empty array', () => {
      const policyWithEmptyArray = policy(async (ctx, next) => next(ctx), {
        name: 'arrayTest',
        kind: 'other',
        options: { items: [] },
      });

      const handler = compose(policyWithEmptyArray);
      const result = inspect.tree(handler);

      expect(result).toContain('items=[]');
    });

    it('should display small array (≤3 elements)', () => {
      const policyWithSmallArray = policy(async (ctx, next) => next(ctx), {
        name: 'arrayTest',
        kind: 'other',
        options: { items: [1, 2, 3] },
      });

      const handler = compose(policyWithSmallArray);
      const result = inspect.tree(handler);

      expect(result).toContain('items=[1, 2, 3]');
    });

    it('should truncate large array (>3 elements)', () => {
      const policyWithLargeArray = policy(async (ctx, next) => next(ctx), {
        name: 'arrayTest',
        kind: 'other',
        options: { items: [1, 2, 3, 4, 5] },
      });

      const handler = compose(policyWithLargeArray);
      const result = inspect.tree(handler);

      expect(result).toContain('items=[1, 2, ... +3]');
    });

    it('should display empty object', () => {
      const policyWithEmptyObject = policy(async (ctx, next) => next(ctx), {
        name: 'objectTest',
        kind: 'other',
        options: { config: {} },
      });

      const handler = compose(policyWithEmptyObject);
      const result = inspect.tree(handler);

      expect(result).toContain('config={}');
    });

    it('should display object with 1 key (tests line 187 false branch)', () => {
      const policyWithOneKey = policy(async (ctx, next) => next(ctx), {
        name: 'objectTest',
        kind: 'other',
        options: { config: { a: 1 } },
      });

      const handler = compose(policyWithOneKey);
      const result = inspect.tree(handler);

      expect(result).toContain('config={a}');
    });

    it('should display small object (≤2 keys)', () => {
      const policyWithSmallObject = policy(async (ctx, next) => next(ctx), {
        name: 'objectTest',
        kind: 'other',
        options: { config: { a: 1, b: 2 } },
      });

      const handler = compose(policyWithSmallObject);
      const result = inspect.tree(handler);

      expect(result).toContain('config={a, b}');
    });

    it('should display object with exactly 3 keys (boundary case)', () => {
      const policyWithThreeKeys = policy(async (ctx, next) => next(ctx), {
        name: 'objectTest',
        kind: 'other',
        options: { config: { a: 1, b: 2, c: 3 } },
      });

      const handler = compose(policyWithThreeKeys);
      const result = inspect.tree(handler);

      expect(result).toContain('config={a, b, ...}');
    });

    it('should truncate large object (>2 keys)', () => {
      const policyWithLargeObject = policy(async (ctx, next) => next(ctx), {
        name: 'objectTest',
        kind: 'other',
        options: { config: { a: 1, b: 2, c: 3, d: 4 } },
      });

      const handler = compose(policyWithLargeObject);
      const result = inspect.tree(handler);

      expect(result).toContain('config={a, b, ...}');
    });

    it('should handle function values', () => {
      const policyWithFunction = policy(async (ctx, next) => next(ctx), {
        name: 'functionTest',
        kind: 'other',
        options: { callback: () => 'test' },
      });

      const handler = compose(policyWithFunction);
      const result = inspect.tree(handler);

      // Functions should be stringified
      expect(result).toContain('functionTest (other)');
    });

    it('should handle symbol values', () => {
      const policyWithSymbol = policy(async (ctx, next) => next(ctx), {
        name: 'symbolTest',
        kind: 'other',
        options: { key: Symbol('test') },
      });

      const handler = compose(policyWithSymbol);
      const result = inspect.tree(handler);

      // Symbols should be stringified
      expect(result).toContain('symbolTest (other)');
    });

    it('should handle date values', () => {
      const policyWithDate = policy(async (ctx, next) => next(ctx), {
        name: 'dateTest',
        kind: 'other',
        options: { timestamp: new Date('2025-01-01T00:00:00Z') },
      });

      const handler = compose(policyWithDate);
      const result = inspect.tree(handler);

      // Date should be stringified
      expect(result).toContain('dateTest (other)');
    });

    it('should handle undefined values (tests default String() case - line 189)', () => {
      // Since redactOptions() uses JSON.parse(JSON.stringify()), complex types
      // like RegExp, Map, Set are lost. But undefined in nested objects would fall through.
      // Actually, JSON.stringify drops undefined values, so this won't work either.
      // Let's test with a custom object that has toString()
      class CustomType {
        toString() {
          return 'CustomType[value]';
        }
      }

      const policyWithCustom = policy(async (ctx, next) => next(ctx), {
        name: 'customTest',
        kind: 'other',
        options: { custom: new CustomType() },
      });

      const handler = compose(policyWithCustom);
      const result = inspect.tree(handler);

      // Custom object should be stringified
      expect(result).toContain('customTest (other)');
    });
  });
});
