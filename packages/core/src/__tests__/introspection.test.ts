/**
 * @unireq/core - Introspection tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachToGraph,
  getHandlerGraph,
  getInspectableMeta,
  policy,
  redactOptions,
  resetIdCounter,
} from '../introspection.js';
import type { Policy } from '../types.js';

describe('@unireq/core - introspection', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('policy() tagging', () => {
    it('should attach metadata to policy function', () => {
      const testPolicy: Policy = async (ctx, next) => next(ctx);

      const tagged = policy(testPolicy, {
        name: 'testPolicy',
        kind: 'other',
        options: { foo: 'bar' },
      });

      const meta = getInspectableMeta(tagged);
      expect(meta?.name).toBe('testPolicy');
      expect(meta?.kind).toBe('other');
      expect(meta?.options).toEqual({ foo: 'bar' });
      expect(meta?.id).toBe('testPolicy#0');
    });

    it('should generate non-deterministic IDs in production mode', () => {
      // Temporarily disable test mode
      const originalNodeEnv = process.env['NODE_ENV'];
      const originalVitest = process.env['VITEST'];
      process.env['NODE_ENV'] = 'production';
      process.env['VITEST'] = '';

      const policy1 = policy(async (ctx, next) => next(ctx), {
        name: 'prod',
        kind: 'other',
      });

      const policy2 = policy(async (ctx, next) => next(ctx), {
        name: 'prod',
        kind: 'other',
      });

      const meta1 = getInspectableMeta(policy1);
      const meta2 = getInspectableMeta(policy2);

      // IDs should be different (random UUID prefix)
      expect(meta1?.id).not.toBe(meta2?.id);
      expect(meta1?.id).toMatch(/^prod#[a-f0-9]{8}$/);
      expect(meta2?.id).toMatch(/^prod#[a-f0-9]{8}$/);

      // Restore env
      if (originalNodeEnv) process.env['NODE_ENV'] = originalNodeEnv;
      if (originalVitest) process.env['VITEST'] = originalVitest;
    });

    it('should generate deterministic IDs in test mode', () => {
      const policy1 = policy(async (ctx, next) => next(ctx), {
        name: 'policy1',
        kind: 'other',
      });

      const policy2 = policy(async (ctx, next) => next(ctx), {
        name: 'policy2',
        kind: 'other',
      });

      expect(getInspectableMeta(policy1)?.id).toBe('policy1#0');
      expect(getInspectableMeta(policy2)?.id).toBe('policy2#1');
    });

    it('should reset ID counter', () => {
      policy(async (ctx, next) => next(ctx), { name: 'test', kind: 'other' });
      policy(async (ctx, next) => next(ctx), { name: 'test', kind: 'other' });

      resetIdCounter();

      const p = policy(async (ctx, next) => next(ctx), { name: 'test', kind: 'other' });
      expect(getInspectableMeta(p)?.id).toBe('test#0');
    });
  });

  describe('redactOptions()', () => {
    it('should redact secret keys', () => {
      const options = {
        token: 'secret-token',
        accessToken: 'secret-access',
        refreshToken: 'secret-refresh',
        clientSecret: 'secret-client',
        password: 'secret-password',
        apiKey: 'secret-key',
        normalValue: 'visible',
      };

      const redacted = redactOptions(options);

      expect(redacted['token']).toBe('***redacted***');
      expect(redacted['accessToken']).toBe('***redacted***');
      expect(redacted['refreshToken']).toBe('***redacted***');
      expect(redacted['clientSecret']).toBe('***redacted***');
      expect(redacted['password']).toBe('***redacted***');
      expect(redacted['apiKey']).toBe('***redacted***');
      expect(redacted['normalValue']).toBe('visible');
    });

    it('should redact keys containing "secret" or "token"', () => {
      const options = {
        mySecretKey: 'should-be-redacted',
        customToken: 'should-be-redacted',
        normalValue: 'visible',
      };

      const redacted = redactOptions(options);

      expect(redacted['mySecretKey']).toBe('***redacted***');
      expect(redacted['customToken']).toBe('***redacted***');
      expect(redacted['normalValue']).toBe('visible');
    });

    it('should handle empty options', () => {
      expect(redactOptions({})).toEqual({});
    });

    it('should not mutate original object', () => {
      const original = { token: 'secret', value: 'visible' };
      const redacted = redactOptions(original);

      expect(original['token']).toBe('secret');
      expect(redacted['token']).toBe('***redacted***');
    });

    it('should handle null or undefined options', () => {
      expect(redactOptions(null as any)).toEqual({});
      expect(redactOptions(undefined as any)).toEqual({});
    });

    it('should handle non-object options', () => {
      expect(redactOptions('string' as any)).toEqual({});
      expect(redactOptions(42 as any)).toEqual({});
      expect(redactOptions(true as any)).toEqual({});
    });

    it('should support extraKeys parameter', () => {
      const options = {
        customSecret: 'should-be-redacted',
        normalValue: 'visible',
      };

      const redacted = redactOptions(options, ['customSecret']);

      expect(redacted['customSecret']).toBe('***redacted***');
      expect(redacted['normalValue']).toBe('visible');
    });
  });

  describe('getInspectableMeta()', () => {
    it('should return metadata for tagged policy', () => {
      const tagged = policy(async (ctx, next) => next(ctx), {
        name: 'test',
        kind: 'auth',
        options: { foo: 'bar' },
      });

      const meta = getInspectableMeta(tagged);
      expect(meta?.name).toBe('test');
      expect(meta?.kind).toBe('auth');
    });

    it('should return undefined for untagged policy', () => {
      const untagged: Policy = async (ctx, next) => next(ctx);
      const meta = getInspectableMeta(untagged);

      expect(meta).toBeUndefined();
    });
  });

  describe('attachToGraph() and getHandlerGraph()', () => {
    it('should attach and retrieve handler graph', () => {
      const handler = (async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      })) as any;

      const meta1 = {
        id: 'test#0',
        name: 'policy1',
        kind: 'auth' as const,
      };

      const meta2 = {
        id: 'test#1',
        name: 'policy2',
        kind: 'parser' as const,
      };

      attachToGraph(handler, meta1);
      attachToGraph(handler, meta2);

      const graph = getHandlerGraph(handler);
      expect(graph).toHaveLength(2);
      expect(graph[0]).toEqual(meta1);
      expect(graph[1]).toEqual(meta2);
    });

    it('should return empty array for handler without graph', () => {
      const handler = (async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      })) as any;

      const graph = getHandlerGraph(handler);
      expect(graph).toEqual([]);
    });
  });
});
