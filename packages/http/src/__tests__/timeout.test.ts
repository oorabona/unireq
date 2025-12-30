/**
 * @unireq/http - Timeout policy tests
 * Tests for AbortSignal improvements (Task 1.3)
 */

import type { RequestContext, Response } from '@unireq/core';
import { TimeoutError } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhaseTimeouts } from '../policies.js';
import { timeout } from '../policies.js';

// Helper to create a mock response
function createMockResponse(overrides?: Partial<Response>): Response {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    data: 'OK',
    ok: true,
    ...overrides,
  };
}

// Helper to create a mock context
function createMockContext(overrides?: Partial<RequestContext>): RequestContext {
  return {
    url: 'https://example.com/test',
    method: 'GET',
    headers: {},
    ...overrides,
  };
}

// Helper to create a slow transport that respects abort signal
function createSlowTransport(delayMs: number) {
  return async (ctx: RequestContext): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(createMockResponse());
      }, delayMs);

      if (ctx.signal?.aborted) {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      ctx.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  };
}

describe('@unireq/http - timeout policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AC1: Simple numeric timeout (backward compatibility)', () => {
    describe('when timeout(ms) is used', () => {
      it('should abort request after timeout expires', async () => {
        // Arrange
        const policy = timeout(100);
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(500);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert
        await expect(promise).rejects.toThrow();
      });

      it('should return TimeoutError with correct timeoutMs', async () => {
        // Arrange
        const policy = timeout(100);
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(500);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert
        try {
          await promise;
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(TimeoutError);
          expect((error as TimeoutError).timeoutMs).toBe(100);
        }
      });

      it('should complete fast requests within timeout', async () => {
        // Arrange
        const policy = timeout(1000);
        const ctx = createMockContext();
        const fastTransport = createSlowTransport(50);

        // Act
        const promise = policy(ctx, fastTransport);
        vi.advanceTimersByTime(50);
        const response = await promise;

        // Assert
        expect(response.status).toBe(200);
        expect(response.ok).toBe(true);
      });

      it('should abort immediately with timeout(0)', async () => {
        // Arrange
        const policy = timeout(0);
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(100);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(0);

        // Assert
        await expect(promise).rejects.toThrow();
      });
    });
  });

  describe('AC2: Per-phase timeouts with { total }', () => {
    describe('when timeout({ total: ms }) is used', () => {
      it('should behave identically to timeout(ms)', async () => {
        // Arrange
        const policy = timeout({ total: 100 });
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(500);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert
        await expect(promise).rejects.toThrow();
      });

      it('should complete fast requests', async () => {
        // Arrange
        const policy = timeout({ total: 1000 });
        const ctx = createMockContext();
        const fastTransport = createSlowTransport(50);

        // Act
        const promise = policy(ctx, fastTransport);
        vi.advanceTimersByTime(50);
        const response = await promise;

        // Assert
        expect(response.status).toBe(200);
      });
    });
  });

  describe('AC3: Signal composition with user abort', () => {
    describe('when user signal is combined with timeout', () => {
      it('should abort when user aborts before timeout', async () => {
        // Arrange
        const userController = new AbortController();
        const policy = timeout(10000);
        const ctx = createMockContext({ signal: userController.signal });
        const slowTransport = createSlowTransport(5000);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(50);
        userController.abort();

        // Assert - should reject with AbortError, not TimeoutError
        await expect(promise).rejects.toThrow();
        try {
          await promise;
        } catch (error) {
          expect(error).toBeInstanceOf(DOMException);
          expect((error as DOMException).name).toBe('AbortError');
        }
      });

      it('should timeout when user does not abort', async () => {
        // Arrange
        const userController = new AbortController();
        const policy = timeout(100);
        const ctx = createMockContext({ signal: userController.signal });
        const slowTransport = createSlowTransport(5000);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert
        await expect(promise).rejects.toThrow();
      });

      it('should reject immediately with already aborted signal', async () => {
        // Arrange
        const userController = new AbortController();
        userController.abort(); // Pre-abort
        const policy = timeout(10000);
        const ctx = createMockContext({ signal: userController.signal });
        const slowTransport = createSlowTransport(100);

        // Act & Assert
        const promise = policy(ctx, slowTransport);
        await expect(promise).rejects.toThrow();
      });
    });
  });

  describe('AC4: Graceful cleanup', () => {
    describe('when request completes successfully', () => {
      it('should not leak timers', async () => {
        // Arrange
        const policy = timeout(5000);
        const ctx = createMockContext();
        const fastTransport = createSlowTransport(50);

        // Act
        const promise = policy(ctx, fastTransport);
        vi.advanceTimersByTime(50);
        const response = await promise;

        // Assert - if timers leaked, advancing would cause issues
        expect(response.status).toBe(200);
        vi.advanceTimersByTime(10000); // Should not cause any errors
      });
    });

    describe('when timeout fires', () => {
      it('should cleanup all resources', async () => {
        // Arrange
        const policy = timeout(100);
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(5000);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert
        await expect(promise).rejects.toThrow();
        // Advance more time - should not cause issues if cleanup worked
        vi.advanceTimersByTime(10000);
      });
    });

    describe('when user aborts', () => {
      it('should cleanup abort listeners', async () => {
        // Arrange
        const userController = new AbortController();
        const policy = timeout(10000);
        const ctx = createMockContext({ signal: userController.signal });
        const slowTransport = createSlowTransport(5000);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(50);
        userController.abort();

        // Assert
        await expect(promise).rejects.toThrow();
        // Should not have dangling listeners
        vi.advanceTimersByTime(20000);
      });
    });
  });

  describe('AC5: Native AbortSignal.timeout usage', () => {
    it('should use AbortSignal.timeout for simple timeout', async () => {
      // Arrange
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
      const policy = timeout(5000);
      const ctx = createMockContext();
      const fastTransport = createSlowTransport(50);

      // Act
      const promise = policy(ctx, fastTransport);
      vi.advanceTimersByTime(50);
      await promise;

      // Assert
      expect(timeoutSpy).toHaveBeenCalledWith(5000);
      timeoutSpy.mockRestore();
    });

    it('should use AbortSignal.timeout for { total } config', async () => {
      // Arrange
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
      const policy = timeout({ total: 3000 });
      const ctx = createMockContext();
      const fastTransport = createSlowTransport(50);

      // Act
      const promise = policy(ctx, fastTransport);
      vi.advanceTimersByTime(50);
      await promise;

      // Assert
      expect(timeoutSpy).toHaveBeenCalledWith(3000);
      timeoutSpy.mockRestore();
    });
  });

  describe('AC2: Per-phase timeouts (request, body)', () => {
    describe('when request timeout is set', () => {
      it('should abort if request phase exceeds timeout', async () => {
        // Arrange
        const policy = timeout({ request: 50 });
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(100);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(50);

        // Assert
        await expect(promise).rejects.toThrow();
        try {
          await promise;
        } catch (error) {
          expect((error as Error).message).toContain('connection/TTFB');
        }
      });
    });

    describe('when body timeout is set', () => {
      it('should pass body timeout to connector via context symbol', async () => {
        // Arrange
        const policy = timeout({ body: 100 });
        const ctx = createMockContext();
        let receivedContext: unknown = null;

        const capturingTransport = async (receivedCtx: typeof ctx) => {
          receivedContext = receivedCtx;
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: {},
            ok: true,
          };
        };

        // Act
        await policy(ctx, capturingTransport);

        // Assert - body timeout is passed via symbol
        expect(receivedContext).not.toBeNull();
        const { BODY_TIMEOUT_KEY } = await import('../connectors/undici.js');
        expect((receivedContext as unknown as Record<symbol, unknown>)[BODY_TIMEOUT_KEY]).toBe(100);
      });
    });

    describe('when multiple phase timeouts are set', () => {
      it('should use total timeout as overall limit', async () => {
        // Arrange
        const policy = timeout({
          request: 1000,
          body: 3000,
          total: 100,
        });
        const ctx = createMockContext();
        const slowTransport = createSlowTransport(500);

        // Act
        const promise = policy(ctx, slowTransport);
        vi.advanceTimersByTime(100);

        // Assert - total fires first
        await expect(promise).rejects.toThrow();
        try {
          await promise;
        } catch (error) {
          expect((error as TimeoutError).timeoutMs).toBe(100);
        }
      });

      it('should allow request to complete if within all timeouts', async () => {
        // Arrange
        const policy = timeout({
          request: 100,
          body: 300,
          total: 1000,
        });
        const ctx = createMockContext();
        const fastTransport = createSlowTransport(50);

        // Act
        const promise = policy(ctx, fastTransport);
        vi.advanceTimersByTime(50);
        const response = await promise;

        // Assert
        expect(response.status).toBe(200);
      });

      it('should pass body timeout even when request/total set', async () => {
        // Arrange
        const policy = timeout({
          request: 500,
          body: 200,
          total: 1000,
        });
        const ctx = createMockContext();
        let receivedContext: unknown = null;

        const capturingTransport = async (receivedCtx: typeof ctx) => {
          receivedContext = receivedCtx;
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: {},
            ok: true,
          };
        };

        // Act
        await policy(ctx, capturingTransport);

        // Assert
        const { BODY_TIMEOUT_KEY } = await import('../connectors/undici.js');
        expect((receivedContext as unknown as Record<symbol, unknown>)[BODY_TIMEOUT_KEY]).toBe(200);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle missing signal gracefully', async () => {
      // Arrange
      const policy = timeout(1000);
      const ctx = createMockContext(); // No signal
      const fastTransport = createSlowTransport(50);

      // Act
      const promise = policy(ctx, fastTransport);
      vi.advanceTimersByTime(50);
      const response = await promise;

      // Assert
      expect(response.status).toBe(200);
    });

    it('should handle empty phase config with just total', async () => {
      // Arrange
      const config: PhaseTimeouts = { total: 500 };
      const policy = timeout(config);
      const ctx = createMockContext();
      const slowTransport = createSlowTransport(1000);

      // Act
      const promise = policy(ctx, slowTransport);
      vi.advanceTimersByTime(500);

      // Assert
      await expect(promise).rejects.toThrow();
    });

    it('should passthrough when only body timeout is set (no request/total)', async () => {
      // Arrange - This covers policies.ts line 215
      const policy = timeout({ body: 5000 });
      const ctx = createMockContext(); // No user signal
      let receivedCtx: unknown = null;

      const capturingTransport = async (ctxArg: typeof ctx) => {
        receivedCtx = ctxArg;
        return createMockResponse();
      };

      // Act
      const response = await policy(ctx, capturingTransport);

      // Assert
      expect(response.status).toBe(200);
      // Context should have body timeout but no modified signal
      const { BODY_TIMEOUT_KEY } = await import('../connectors/undici.js');
      expect((receivedCtx as Record<symbol, unknown>)[BODY_TIMEOUT_KEY]).toBe(5000);
    });

    it('should passthrough when empty config is provided', async () => {
      // Arrange - covers line 215 passthrough path
      const policy = timeout({});
      const ctx = createMockContext();

      const mockTransport = async () => createMockResponse();

      // Act
      const response = await policy(ctx, mockTransport);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should passthrough with only user signal (no timeout config)', async () => {
      // Arrange - This covers the early return when only ctx.signal exists
      const userController = new AbortController();
      const policy = timeout({ body: 100 }); // Only body, no request/total
      const ctx = createMockContext({ signal: userController.signal });
      let receivedCtx: unknown = null;

      const capturingTransport = async (ctxArg: typeof ctx) => {
        receivedCtx = ctxArg;
        return createMockResponse();
      };

      // Act
      const response = await policy(ctx, capturingTransport);

      // Assert
      expect(response.status).toBe(200);
      // Signal should be passed through unchanged (user signal only)
      expect((receivedCtx as { signal?: AbortSignal }).signal).toBe(userController.signal);
    });
  });

  describe('AbortSignal.any fallback (Node < 20 compatibility)', () => {
    it('should work when AbortSignal.any is not available', async () => {
      // Arrange - Mock AbortSignal.any to be undefined
      vi.useRealTimers(); // Need real timers for this test
      const originalAny = AbortSignal.any;
      delete (AbortSignal as Partial<typeof AbortSignal>).any;

      try {
        const policy = timeout(100);
        const ctx = createMockContext();

        // Fast transport that completes before timeout
        const fastTransport = async () => {
          return createMockResponse();
        };

        // Act
        const response = await policy(ctx, fastTransport);

        // Assert
        expect(response.status).toBe(200);
      } finally {
        // Restore
        AbortSignal.any = originalAny;
        vi.useFakeTimers();
      }
    });

    it('should abort via fallback when timeout fires (AbortSignal.any unavailable)', async () => {
      // Arrange
      vi.useRealTimers();
      const originalAny = AbortSignal.any;
      delete (AbortSignal as Partial<typeof AbortSignal>).any;

      try {
        const policy = timeout(50);
        const ctx = createMockContext();

        // Slow transport
        const slowTransport = (ctxArg: typeof ctx) =>
          new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(() => resolve(createMockResponse()), 500);
            ctxArg.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });

        // Act & Assert
        await expect(policy(ctx, slowTransport)).rejects.toThrow();
      } finally {
        AbortSignal.any = originalAny;
        vi.useFakeTimers();
      }
    });

    it('should handle already-aborted signal in fallback mode', async () => {
      // Arrange
      vi.useRealTimers();
      const originalAny = AbortSignal.any;
      delete (AbortSignal as Partial<typeof AbortSignal>).any;

      try {
        const userController = new AbortController();
        userController.abort(); // Pre-abort

        const policy = timeout(10000);
        const ctx = createMockContext({ signal: userController.signal });
        const slowTransport = createSlowTransport(100);

        // Act & Assert
        await expect(policy(ctx, slowTransport)).rejects.toThrow();
      } finally {
        AbortSignal.any = originalAny;
        vi.useFakeTimers();
      }
    });

    it('should cleanup listeners in fallback mode after success', async () => {
      // Arrange
      vi.useRealTimers();
      const originalAny = AbortSignal.any;
      delete (AbortSignal as Partial<typeof AbortSignal>).any;

      try {
        const userController = new AbortController();
        const policy = timeout(5000);
        const ctx = createMockContext({ signal: userController.signal });

        const fastTransport = async () => createMockResponse();

        // Act
        const response = await policy(ctx, fastTransport);

        // Assert - response should be OK
        expect(response.status).toBe(200);

        // Aborting after completion should not cause issues
        userController.abort();
      } finally {
        AbortSignal.any = originalAny;
        vi.useFakeTimers();
      }
    });

    it('should combine user signal with timeout signal in fallback mode', async () => {
      // Arrange
      vi.useRealTimers();
      const originalAny = AbortSignal.any;
      delete (AbortSignal as Partial<typeof AbortSignal>).any;

      try {
        const userController = new AbortController();
        const policy = timeout({ request: 100, total: 5000 });
        const ctx = createMockContext({ signal: userController.signal });

        const slowTransport = (ctxArg: typeof ctx) =>
          new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(() => resolve(createMockResponse()), 1000);
            ctxArg.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });

        // Act - user aborts before timeout
        const promise = policy(ctx, slowTransport);
        setTimeout(() => userController.abort(), 30);

        // Assert - should reject with user abort
        await expect(promise).rejects.toThrow();
      } finally {
        AbortSignal.any = originalAny;
        vi.useFakeTimers();
      }
    });
  });
});
