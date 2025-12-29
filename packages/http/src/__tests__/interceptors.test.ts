import type { Policy, RequestContext, Response } from '@unireq/core';
import { describe, expect, it, vi } from 'vitest';
import {
  combineRequestInterceptors,
  combineResponseInterceptors,
  type ErrorInterceptor,
  interceptError,
  interceptRequest,
  interceptResponse,
  type RequestInterceptor,
  type ResponseInterceptor,
} from '../interceptors.js';

describe('interceptors', () => {
  describe('interceptRequest', () => {
    it('should modify request context before calling next', async () => {
      const interceptor: RequestInterceptor = (ctx) => ({
        ...ctx,
        headers: { ...ctx.headers, 'x-custom': 'value' },
      });

      const policy = interceptRequest(interceptor);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/test',
        method: 'GET',
        headers: { 'x-custom': 'value' },
      });
    });

    it('should support async interceptors', async () => {
      const interceptor: RequestInterceptor = async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...ctx, headers: { ...ctx.headers, 'x-async': 'true' } };
      };

      const policy = interceptRequest(interceptor);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/test',
        method: 'GET',
        headers: { 'x-async': 'true' },
      });
    });

    it('should pass through original context if interceptor returns it unchanged', async () => {
      const interceptor: RequestInterceptor = (ctx) => ctx;

      const policy = interceptRequest(interceptor);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: { original: 'header' },
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith(ctx);
    });

    it('should allow interceptor to add auth token', async () => {
      const getToken = async () => 'secret-token';
      const interceptor: RequestInterceptor = async (ctx) => ({
        ...ctx,
        headers: { ...ctx.headers, authorization: `Bearer ${await getToken()}` },
      });

      const policy = interceptRequest(interceptor);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/api/protected',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/api/protected',
        method: 'GET',
        headers: { authorization: 'Bearer secret-token' },
      });
    });
  });

  describe('interceptResponse', () => {
    it('should modify response after receiving it', async () => {
      const interceptor: ResponseInterceptor = (response) => ({
        ...response,
        headers: { ...response.headers, 'x-custom': 'value' },
      });

      const policy = interceptResponse(interceptor);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.headers).toEqual({ 'x-custom': 'value' });
    });

    it('should support async interceptors', async () => {
      const interceptor: ResponseInterceptor = async (response) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ...response,
          data: { ...(response.data as object), processed: true },
        };
      };

      const policy = interceptResponse(interceptor);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.data).toEqual({ message: 'Hello', processed: true });
    });

    it('should pass through original response if interceptor returns it unchanged', async () => {
      const interceptor: ResponseInterceptor = (response) => response;

      const policy = interceptResponse(interceptor);
      const originalResponse: Response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      };
      const next = vi.fn(async () => originalResponse);

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response).toBe(originalResponse);
    });

    it('should allow interceptor to add metadata', async () => {
      const interceptor: ResponseInterceptor = (response) => ({
        ...response,
        data: { ...(response.data as object), receivedAt: Date.now() },
      });

      const policy = interceptResponse(interceptor);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect((response.data as any).receivedAt).toBeDefined();
      expect(typeof (response.data as any).receivedAt).toBe('number');
    });

    it('should have access to request context', async () => {
      const interceptor: ResponseInterceptor = (response, ctx) => ({
        ...response,
        data: { ...(response.data as object), requestedUrl: ctx.url },
      });

      const policy = interceptResponse(interceptor);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/api/users',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect((response.data as any).requestedUrl).toBe('/api/users');
    });
  });

  describe('interceptError', () => {
    it('should catch and handle errors', async () => {
      const interceptor: ErrorInterceptor = (error) => {
        if (error instanceof Error && error.message.includes('Network')) {
          return {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {},
            data: { error: 'Network error occurred' },
            ok: false,
          };
        }
        throw error;
      };

      const policy = interceptError(interceptor);
      const next = vi.fn(async () => {
        throw new Error('Network timeout');
      });

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.status).toBe(503);
      expect(response.data).toEqual({ error: 'Network error occurred' });
    });

    it('should support async error interceptors', async () => {
      const interceptor: ErrorInterceptor = async (_error) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          data: { error: 'Handled async error' },
          ok: false,
        };
      };

      const policy = interceptError(interceptor);
      const next = vi.fn(async () => {
        throw new Error('Server error');
      });

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.status).toBe(500);
      expect(response.data).toEqual({ error: 'Handled async error' });
    });

    it('should rethrow error if interceptor does not handle it', async () => {
      const interceptor: ErrorInterceptor = (error) => {
        // Only handle specific errors
        if (error instanceof Error && error.message.includes('Network')) {
          return {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {},
            data: { error: 'Network error' },
            ok: false,
          };
        }
        throw error;
      };

      const policy = interceptError(interceptor);
      const next = vi.fn(async () => {
        throw new Error('Unknown error');
      });

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await expect(policy(ctx, next)).rejects.toThrow('Unknown error');
    });

    it('should pass through successful responses without calling interceptor', async () => {
      const interceptor: ErrorInterceptor = vi.fn((error) => {
        throw error;
      });

      const policy = interceptError(interceptor);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Success' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.status).toBe(200);
      expect(interceptor).not.toHaveBeenCalled();
    });

    it('should have access to request context in error handler', async () => {
      let capturedUrl = '';
      const interceptor: ErrorInterceptor = (error, ctx) => {
        capturedUrl = ctx.url;
        throw error;
      };

      const policy = interceptError(interceptor);
      const next = vi.fn(async () => {
        throw new Error('Test error');
      });

      const ctx: RequestContext = {
        url: '/api/test',
        method: 'POST',
        headers: {},
      };

      await expect(policy(ctx, next)).rejects.toThrow('Test error');
      expect(capturedUrl).toBe('/api/test');
    });
  });

  describe('combineRequestInterceptors', () => {
    it('should execute multiple interceptors in order', async () => {
      const interceptor1: RequestInterceptor = (ctx) => ({
        ...ctx,
        headers: { ...ctx.headers, 'x-step': '1' },
      });

      const interceptor2: RequestInterceptor = (ctx) => ({
        ...ctx,
        headers: { ...ctx.headers, 'x-step': `${(ctx.headers as Record<string, string>)['x-step']},2` },
      });

      const interceptor3: RequestInterceptor = (ctx) => ({
        ...ctx,
        headers: { ...ctx.headers, 'x-step': `${(ctx.headers as Record<string, string>)['x-step']},3` },
      });

      const policy = combineRequestInterceptors(interceptor1, interceptor2, interceptor3);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/test',
        method: 'GET',
        headers: { 'x-step': '1,2,3' },
      });
    });

    it('should handle empty interceptor array', async () => {
      const policy = combineRequestInterceptors();
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: { original: 'value' },
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith(ctx);
    });

    it('should support async interceptors in combination', async () => {
      const interceptor1: RequestInterceptor = async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...ctx, headers: { ...ctx.headers, step: '1' } };
      };

      const interceptor2: RequestInterceptor = async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...ctx, headers: { ...ctx.headers, step: `${(ctx.headers as Record<string, string>)['step']},2` } };
      };

      const policy = combineRequestInterceptors(interceptor1, interceptor2);
      const next = vi.fn(async (_ctx: RequestContext) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/test',
        method: 'GET',
        headers: { step: '1,2' },
      });
    });
  });

  describe('combineResponseInterceptors', () => {
    it('should execute multiple interceptors in order', async () => {
      const interceptor1: ResponseInterceptor = (response) => ({
        ...response,
        data: { ...(response.data as object), step1: true },
      });

      const interceptor2: ResponseInterceptor = (response) => ({
        ...response,
        data: { ...(response.data as object), step2: true },
      });

      const interceptor3: ResponseInterceptor = (response) => ({
        ...response,
        data: { ...(response.data as object), step3: true },
      });

      const policy = combineResponseInterceptors(interceptor1, interceptor2, interceptor3);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.data).toEqual({
        message: 'Hello',
        step1: true,
        step2: true,
        step3: true,
      });
    });

    it('should handle empty interceptor array', async () => {
      const policy = combineResponseInterceptors();
      const originalResponse: Response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      };
      const next = vi.fn(async () => originalResponse);

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response).toBe(originalResponse);
    });

    it('should support async interceptors in combination', async () => {
      const interceptor1: ResponseInterceptor = async (response) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...response, data: { ...(response.data as object), async1: true } };
      };

      const interceptor2: ResponseInterceptor = async (response) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...response, data: { ...(response.data as object), async2: true } };
      };

      const policy = combineResponseInterceptors(interceptor1, interceptor2);
      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.data).toEqual({
        message: 'Hello',
        async1: true,
        async2: true,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should support logging interceptor', async () => {
      const logs: string[] = [];

      const logRequest: RequestInterceptor = (ctx) => {
        logs.push(`${ctx.method} ${ctx.url}`);
        return ctx;
      };

      const logResponse: ResponseInterceptor = (response, ctx) => {
        logs.push(`${ctx.method} ${ctx.url} -> ${response.status}`);
        return response;
      };

      const requestPolicy = interceptRequest(logRequest);
      const responsePolicy = interceptResponse(logResponse);

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Success' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/api/users',
        method: 'GET',
        headers: {},
      };

      // Apply request interceptor
      await requestPolicy(ctx, async (modifiedCtx) => {
        // Apply response interceptor
        return responsePolicy(modifiedCtx, next);
      });

      expect(logs).toEqual(['GET /api/users', 'GET /api/users -> 200']);
    });

    it('should support metrics collection', async () => {
      const metrics = {
        requestCount: 0,
        responseCount: 0,
        errorCount: 0,
      };

      const countRequest: RequestInterceptor = (ctx) => {
        metrics.requestCount++;
        return ctx;
      };

      const countResponse: ResponseInterceptor = (response) => {
        metrics.responseCount++;
        return response;
      };

      const countError: ErrorInterceptor = (error) => {
        metrics.errorCount++;
        throw error;
      };

      const requestPolicy = interceptRequest(countRequest);
      const responsePolicy = interceptResponse(countResponse);
      const errorPolicy = interceptError(countError);

      // Success case
      const successNext = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: null,
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/test',
        method: 'GET',
        headers: {},
      };

      await requestPolicy(ctx, async (modifiedCtx) => {
        return responsePolicy(modifiedCtx, successNext);
      });

      expect(metrics).toEqual({
        requestCount: 1,
        responseCount: 1,
        errorCount: 0,
      });

      // Error case
      const errorNext = vi.fn(async () => {
        throw new Error('Test error');
      });

      await expect(
        requestPolicy(ctx, async (modifiedCtx) => {
          return errorPolicy(modifiedCtx, errorNext);
        }),
      ).rejects.toThrow('Test error');

      expect(metrics).toEqual({
        requestCount: 2,
        responseCount: 1,
        errorCount: 1,
      });
    });

    it('should support custom cache interceptor', async () => {
      const cache = new Map<string, Response>();

      // Cache policy that checks cache before request
      const cachePolicy: Policy = async (ctx, next) => {
        const cacheKey = `${ctx.method}:${ctx.url}`;
        const cached = cache.get(cacheKey);

        // Return cached response if available
        if (cached && ctx.method === 'GET') {
          return cached;
        }

        // Otherwise make request and cache if successful
        const response = await next(ctx);
        if (ctx.method === 'GET' && response.ok) {
          cache.set(cacheKey, response);
        }

        return response;
      };

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Fresh data' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/api/data',
        method: 'GET',
        headers: {},
      };

      // First request - cache miss
      await cachePolicy(ctx, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      next.mockClear();
      await cachePolicy(ctx, next);
      expect(next).toHaveBeenCalledTimes(0); // Cache hit, next not called
    });
  });
});
