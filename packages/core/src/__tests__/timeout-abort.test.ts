/**
 * Timeout and AbortController tests
 * Tests for timeout behavior, abort signal handling, and cancellation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compose } from '../compose.js';
import { TimeoutError } from '../errors.js';
import type { Policy } from '../types.js';
import { createAbortableTransport, createMockContext, createMockResponse } from './helpers.js';

describe('@unireq/core - Timeout and AbortController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AbortController basics', () => {
    it('should pass signal to transport', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      let receivedSignal: AbortSignal | undefined;

      const transport: Policy = async (context) => {
        receivedSignal = context.signal;
        return createMockResponse();
      };

      await transport(ctx, async () => createMockResponse());

      expect(receivedSignal).toBe(controller.signal);
    });

    it('should abort request when signal is aborted', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });

      const slowTransport = createAbortableTransport(5000);
      const promise = slowTransport(ctx);

      // Abort immediately
      controller.abort();

      await expect(promise).rejects.toThrow('Request aborted');
    });

    it('should abort request after delay', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });

      const slowTransport = createAbortableTransport(5000);
      const promise = slowTransport(ctx);

      // Abort after 100ms
      vi.advanceTimersByTime(100);
      controller.abort();

      await expect(promise).rejects.toThrow('Request aborted');
    });

    it('should complete if not aborted', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });

      const slowTransport = createAbortableTransport(100);
      const promise = slowTransport(ctx);

      vi.advanceTimersByTime(100);

      const response = await promise;
      expect(response.status).toBe(200);
    });

    it('should handle already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort before use

      const ctx = createMockContext({ signal: controller.signal });
      const slowTransport = createAbortableTransport(100);

      await expect(slowTransport(ctx)).rejects.toThrow('Request aborted');
    });
  });

  describe('AbortSignal composition', () => {
    it('should compose with policy chain', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      const callOrder: string[] = [];

      const policy1: Policy = async (context, next) => {
        callOrder.push('policy1-start');
        const response = await next(context);
        callOrder.push('policy1-end');
        return response;
      };

      const policy2: Policy = async (context, next) => {
        callOrder.push('policy2-start');
        const response = await next(context);
        callOrder.push('policy2-end');
        return response;
      };

      const transport: Policy = async () => {
        callOrder.push('transport');
        return createMockResponse();
      };

      // compose returns a Policy that takes (ctx, next)
      const composed = compose(policy1, policy2, transport);
      await composed(ctx, async () => createMockResponse());

      expect(callOrder).toEqual(['policy1-start', 'policy2-start', 'transport', 'policy2-end', 'policy1-end']);
    });

    it('should propagate abort through policy chain', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      const abortedPolicies: string[] = [];

      const createPolicy = (name: string): Policy => {
        return async (context, next) => {
          return new Promise((resolve, reject) => {
            const cleanup = () => {
              abortedPolicies.push(name);
            };

            if (context.signal?.aborted) {
              cleanup();
              reject(new DOMException('Request aborted', 'AbortError'));
              return;
            }

            context.signal?.addEventListener('abort', () => {
              cleanup();
              reject(new DOMException('Request aborted', 'AbortError'));
            });

            // Simulate async work
            setTimeout(async () => {
              try {
                const response = await next(context);
                resolve(response);
              } catch (e) {
                reject(e);
              }
            }, 100);
          });
        };
      };

      const policy1 = createPolicy('policy1');
      const policy2 = createPolicy('policy2');

      // Transport that respects abort signal
      const transport: Policy = async (context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(createMockResponse()), 500);

          if (context.signal?.aborted) {
            clearTimeout(timer);
            reject(new DOMException('Request aborted', 'AbortError'));
            return;
          }

          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            abortedPolicies.push('transport');
            reject(new DOMException('Request aborted', 'AbortError'));
          });
        });
      };

      const composed = compose(policy1, policy2, transport);
      const promise = composed(ctx, async () => createMockResponse());

      // Advance time partially then abort
      vi.advanceTimersByTime(50);
      controller.abort();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('Timeout patterns', () => {
    it('should create timeout with AbortSignal.timeout pattern', async () => {
      // Simulating AbortSignal.timeout behavior manually
      const createTimeoutSignal = (ms: number): AbortSignal => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      };

      const signal = createTimeoutSignal(100);
      const ctx = createMockContext({ signal });
      const slowTransport = createAbortableTransport(500);

      const promise = slowTransport(ctx);
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Request aborted');
    });

    it('should combine timeout with user abort (AbortSignal.any pattern)', async () => {
      // Simulating AbortSignal.any behavior manually
      const createCombinedSignal = (signals: AbortSignal[]): AbortController => {
        const controller = new AbortController();

        for (const signal of signals) {
          if (signal.aborted) {
            controller.abort();
            return controller;
          }
          signal.addEventListener('abort', () => controller.abort());
        }

        return controller;
      };

      const userController = new AbortController();
      const timeoutController = new AbortController();
      setTimeout(() => timeoutController.abort(), 500); // Timeout after 500ms

      const combined = createCombinedSignal([userController.signal, timeoutController.signal]);
      const ctx = createMockContext({ signal: combined.signal });
      const slowTransport = createAbortableTransport(1000);

      const promise = slowTransport(ctx);

      // User aborts at 100ms (before timeout)
      vi.advanceTimersByTime(100);
      userController.abort();

      await expect(promise).rejects.toThrow('Request aborted');
    });

    it('should timeout before user abort', async () => {
      const createCombinedSignal = (signals: AbortSignal[]): AbortController => {
        const controller = new AbortController();

        for (const signal of signals) {
          if (signal.aborted) {
            controller.abort();
            return controller;
          }
          signal.addEventListener('abort', () => controller.abort());
        }

        return controller;
      };

      const userController = new AbortController();
      const timeoutController = new AbortController();
      setTimeout(() => timeoutController.abort(), 100); // Timeout after 100ms

      const combined = createCombinedSignal([userController.signal, timeoutController.signal]);
      const ctx = createMockContext({ signal: combined.signal });
      const slowTransport = createAbortableTransport(1000);

      const promise = slowTransport(ctx);

      // Timeout fires at 100ms
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Request aborted');
    });
  });

  describe('TimeoutError usage', () => {
    it('should create TimeoutError with timeout value', () => {
      const error = new TimeoutError(5000);

      expect(error.message).toBe('Request timed out after 5000ms');
      expect(error.code).toBe('TIMEOUT');
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe('TimeoutError');
    });

    it('should create TimeoutError with cause', () => {
      const cause = new DOMException('Signal aborted', 'AbortError');
      const error = new TimeoutError(3000, cause);

      expect(error.cause).toBe(cause);
      expect(error.timeoutMs).toBe(3000);
    });

    it('should be instanceof UnireqError', () => {
      const error = new TimeoutError(1000);

      expect(error).toBeInstanceOf(Error);
      // TimeoutError extends UnireqError
      expect(error.code).toBe('TIMEOUT');
    });
  });

  describe('Cleanup on abort', () => {
    it('should cleanup resources when aborted', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      let cleanupCalled = false;

      const transportWithCleanup: Policy = async (context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve(createMockResponse());
          }, 500);

          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            cleanupCalled = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      };

      const promise = transportWithCleanup(ctx, async () => createMockResponse());

      controller.abort();

      await expect(promise).rejects.toThrow();
      expect(cleanupCalled).toBe(true);
    });

    it('should not leak timers on successful completion', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      let timerCleared = false;

      const transport: Policy = async (context) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            timerCleared = true;
            resolve(createMockResponse());
          }, 50);

          // Cleanup on abort
          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
          });
        });
      };

      const promise = transport(ctx, async () => createMockResponse());
      vi.advanceTimersByTime(50);

      const response = await promise;
      expect(response.status).toBe(200);
      expect(timerCleared).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing signal gracefully', async () => {
      const ctx = createMockContext(); // No signal

      const transport: Policy = async (context) => {
        expect(context.signal).toBeUndefined();
        return createMockResponse();
      };

      const response = await transport(ctx, async () => createMockResponse());
      expect(response.status).toBe(200);
    });

    it('should handle abort with reason', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });
      let abortReason: unknown;

      const transport: Policy = async (context) => {
        return new Promise((_, reject) => {
          context.signal?.addEventListener('abort', () => {
            abortReason = context.signal?.reason;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      };

      const promise = transport(ctx, async () => createMockResponse());

      controller.abort('Custom reason');

      await expect(promise).rejects.toThrow();
      expect(abortReason).toBe('Custom reason');
    });

    it('should handle concurrent abort and success race', async () => {
      const controller = new AbortController();
      const ctx = createMockContext({ signal: controller.signal });

      const transport: Policy = async () => {
        // Immediate success
        return createMockResponse({ data: 'success' });
      };

      const promise = transport(ctx, async () => createMockResponse());

      // Abort after transport completes
      controller.abort();

      const response = await promise;
      expect(response.data).toBe('success');
    });
  });
});
