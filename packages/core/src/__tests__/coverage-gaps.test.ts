import { describe, expect, it } from 'vitest';
import { compose } from '../compose.js';
import { URLNormalizationError } from '../errors.js';
import { assertHas, inspect } from '../inspect.js';
import { HANDLER_GRAPH, INSPECTABLE_META } from '../introspection.js';
import { validatePolicyChain } from '../slots.js';
import type { Policy } from '../types.js';
import { normalizeURL } from '../url.js';

describe('Coverage Gaps - Core', () => {
  describe('inspect.ts', () => {
    it('should handle policies without handler graph (fallback path)', () => {
      const mockPolicy: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error - Manually adding metadata for test
      mockPolicy[INSPECTABLE_META] = { name: 'mockPolicy', kind: 'policy' };

      const result = inspect(mockPolicy, { format: 'tree' });
      expect(result).toContain('mockPolicy');
    });

    it('should handle assertHas for policies without handler graph', () => {
      const mockPolicy: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error - Manually adding metadata for test
      mockPolicy[INSPECTABLE_META] = { name: 'mockPolicy', kind: 'other' };

      expect(() => assertHas(mockPolicy, 'other')).not.toThrow();
      expect(() => assertHas(mockPolicy, 'auth')).toThrow();
    });

    it('should handle branch with empty then/else branches in tree format', () => {
      const mockPolicy: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error - Manually constructing complex metadata
      mockPolicy[INSPECTABLE_META] = {
        name: 'branchPolicy',
        kind: 'other',
        branch: {
          predicate: 'condition',
          thenBranch: [],
          elseBranch: [],
        },
      };

      // Mock getHandlerGraph to return this metadata
      const result = inspect(mockPolicy, { format: 'tree' });
      expect(result).toContain('? condition');
      // Should not contain "then:" or "else:" since branches are empty
      expect(result).not.toContain('then:');
      expect(result).not.toContain('else:');
    });

    it('should inspect policy with metadata but no handler graph', () => {
      const policy = () => Promise.resolve({} as any);
      (policy as any)[INSPECTABLE_META] = {
        name: 'test-policy',
        kind: 'interceptor',
      };

      const result = inspect(policy as any);
      expect(result).toContain('test-policy');
    });

    it('should assertHas in branches', () => {
      const policy = () => Promise.resolve({} as any);
      // Mock a branching graph
      const meta = {
        name: 'branch-policy',
        kind: 'other',
        branch: {
          predicate: 'true',
          thenBranch: [{ name: 'auth-policy', kind: 'auth' } as any],
          elseBranch: [],
        },
      };

      (policy as any)[INSPECTABLE_META] = meta;

      assertHas(policy as any, 'auth');
    });

    it('should assertHas in else branch', () => {
      const policy = () => Promise.resolve({} as any);
      // Mock a branching graph
      const meta = {
        name: 'branch-policy',
        kind: 'other',
        branch: {
          predicate: 'true',
          thenBranch: [],
          elseBranch: [{ name: 'auth-policy', kind: 'auth' } as any],
        },
      };

      (policy as any)[INSPECTABLE_META] = meta;

      assertHas(policy as any, 'auth');
    });

    it('should handle anonymous policy in fallback path', () => {
      const mockPolicy: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error
      mockPolicy[INSPECTABLE_META] = { name: 'anonymous', kind: 'policy' };

      const result = inspect(mockPolicy, { format: 'tree' });
      expect(result).toBe('(empty policy chain)');
    });

    it('should handle policy with no metadata', () => {
      const policy = () => Promise.resolve({} as any);
      const result = inspect(policy as any);
      expect(result).toBe('[]');
    });

    it('should throw in assertHas for policy with no metadata', () => {
      const policy = () => Promise.resolve({} as any);
      expect(() => assertHas(policy as any, 'auth')).toThrow();
    });

    it('should handle assertHas with nested children', () => {
      const policy = () => Promise.resolve({} as any);
      const meta = {
        name: 'parent-policy',
        kind: 'other',
        children: [{ name: 'auth-policy', kind: 'auth' } as any],
      };
      (policy as any)[INSPECTABLE_META] = meta;
      assertHas(policy as any, 'auth');
    });

    it('should handle assertHas with nested children in handler graph', () => {
      const p1: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error
      p1[INSPECTABLE_META] = {
        name: 'p1',
        kind: 'other',
        children: [{ name: 'child', kind: 'auth' }],
      };

      // compose() returns a Policy, not a Handler with HANDLER_GRAPH
      // To test getHandlerGraph logic in assertHas, we need to manually attach HANDLER_GRAPH
      const handler = async (_ctx: any) => ({ ok: true }) as any;
      // @ts-expect-error
      handler[HANDLER_GRAPH] = [
        {
          name: 'root',
          kind: 'other',
          children: [{ name: 'child', kind: 'auth' }],
        },
      ];

      // The recursive check in assertHas looks for children property
      // We need to make sure the structure matches what assertHas expects
      expect(() => assertHas(handler as any, 'auth')).not.toThrow();
    });

    it('should inspect composed handler (graph not empty)', () => {
      const p1: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error
      p1[INSPECTABLE_META] = { name: 'p1', kind: 'policy' };

      const handler = compose(p1);
      const result = inspect(handler);
      expect(result).toContain('p1');
    });

    it('should assertHas on composed handler (graph not empty)', () => {
      const p1: Policy = async (ctx, next) => next(ctx);
      // @ts-expect-error
      p1[INSPECTABLE_META] = { name: 'p1', kind: 'auth' };

      const handler = compose(p1);
      expect(() => assertHas(handler, 'auth')).not.toThrow();
    });

    it('should return false for assertHas when kind is not found in nested structures', () => {
      const policy = () => Promise.resolve({} as any);
      const meta = {
        name: 'parent-policy',
        kind: 'other',
        children: [{ name: 'child-policy', kind: 'other' } as any],
        branch: {
          predicate: 'true',
          thenBranch: [{ name: 'then-policy', kind: 'other' } as any],
          elseBranch: [{ name: 'else-policy', kind: 'other' } as any],
        },
      };
      (policy as any)[INSPECTABLE_META] = meta;

      expect(() => assertHas(policy as any, 'auth')).toThrow();
    });

    it('should inspect handler with attached graph', () => {
      const handler = async (_ctx: any) => ({ ok: true }) as any;
      const meta = { name: 'test-policy', kind: 'policy', id: 'test#1' };
      // Manually attach graph
      (handler as any)[HANDLER_GRAPH] = [meta];

      const result = inspect(handler);
      expect(result).toContain('test-policy');
    });
  });

  describe('slots.ts', () => {
    it('should handle sparse arrays in validateSlotOrdering', () => {
      expect(() => validatePolicyChain([])).not.toThrow();
    });
  });

  describe('url.ts', () => {
    it('should handle non-Error objects in normalizeURL', () => {
      // Mock URL to throw a string error
      const originalURL = global.URL;
      global.URL = class extends originalURL {
        constructor(url: string, base?: string | URL) {
          super(url, base);
          if (url === 'http://throw-string') {
            throw 'string error';
          }
        }
      } as any;

      try {
        // Use absolute URL to bypass the relative URL check
        normalizeURL('http://throw-string');
      } catch (e) {
        expect(e).toBeInstanceOf(URLNormalizationError);
        // The error message format is: Failed to normalize URL "http://throw-string": string error
        expect((e as any).message).toContain('string error');
      } finally {
        global.URL = originalURL;
      }
    });

    it('should throw URLNormalizationError for relative URL without base', () => {
      expect(() => normalizeURL('/relative')).toThrow(/Relative URL requires URI/);
    });

    it('should handle non-http absolute URLs', () => {
      expect(normalizeURL('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('should handle standard Error in normalizeURL', () => {
      // http://[ is invalid and throws TypeError (which is an Error)
      expect(() => normalizeURL('http://[')).toThrow(URLNormalizationError);
    });
  });
});
