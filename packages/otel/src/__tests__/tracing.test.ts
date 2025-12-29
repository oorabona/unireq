import type { Span, Tracer } from '@opentelemetry/api';
import type { RequestContext, Response } from '@unireq/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { otel } from '../tracing.js';

// Mock OpenTelemetry API
vi.mock('@opentelemetry/api', () => {
  return {
    SpanKind: { CLIENT: 2 },
    SpanStatusCode: { OK: 1, ERROR: 2 },
    context: { active: vi.fn().mockReturnValue({}) },
    propagation: { inject: vi.fn() },
    trace: {
      setSpan: vi.fn().mockReturnValue({}),
    },
    default: {
      SpanKind: { CLIENT: 2 },
      SpanStatusCode: { OK: 1, ERROR: 2 },
      context: { active: vi.fn().mockReturnValue({}) },
      propagation: { inject: vi.fn() },
      trace: { setSpan: vi.fn().mockReturnValue({}) },
    },
  };
});

type NextFn = (ctx: RequestContext) => Promise<Response>;

describe('@unireq/otel', () => {
  let mockSpan: Partial<Span>;
  let mockTracer: Partial<Tracer>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpan = {
      setAttribute: vi.fn().mockReturnThis(),
      setStatus: vi.fn().mockReturnThis(),
      recordException: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    mockTracer = {
      startSpan: vi.fn().mockReturnValue(mockSpan),
    };

    mockNext = vi.fn();
  });

  describe('otel policy', () => {
    it('creates a span for HTTP requests', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const response: Response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { users: [] },
        ok: true,
      };

      mockNext.mockResolvedValue(response);

      const result = await policy(ctx, mockNext as NextFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP GET',
        expect.objectContaining({
          kind: 2, // SpanKind.CLIENT
          attributes: expect.objectContaining({
            'http.request.method': 'GET',
            'url.full': 'https://api.example.com/users',
            'server.address': 'api.example.com',
          }),
        }),
      );

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.response.status_code', 200);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 }); // SpanStatusCode.OK
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe(response);
    });

    it('uses custom span name formatter', async () => {
      const spanNameFormatter = vi.fn().mockReturnValue('Custom Span');
      const policy = otel({
        tracer: mockTracer as Tracer,
        spanNameFormatter,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(spanNameFormatter).toHaveBeenCalledWith(ctx);
      expect(mockTracer.startSpan).toHaveBeenCalledWith('Custom Span', expect.any(Object));
    });

    it('records request body size when enabled', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        body: { name: 'John Doe' },
      };

      mockNext.mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.body.size', expect.any(Number));
    });

    it('records response body size when enabled', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordResponseBodySize: true,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { users: [{ id: 1, name: 'John' }] },
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.response.body.size', expect.any(Number));
    });

    it('adds custom attributes', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        customAttributes: {
          'service.version': '1.0.0',
          'deployment.environment': 'production',
        },
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP GET',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'service.version': '1.0.0',
            'deployment.environment': 'production',
          }),
        }),
      );
    });

    it('sets error status for 4xx responses', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users/999',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: { error: 'User not found' },
        ok: false,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2, // SpanStatusCode.ERROR
        message: 'HTTP 404 Not Found',
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.type', '404');
    });

    it('sets error status for 5xx responses', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error: 'Something went wrong' },
        ok: false,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2, // SpanStatusCode.ERROR
        message: 'HTTP 500 Internal Server Error',
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.type', '500');
    });

    it('records exception on request failure', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const error = new Error('Network error');
      mockNext.mockRejectedValue(error);

      await expect(policy(ctx, mockNext as NextFn)).rejects.toThrow('Network error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2, // SpanStatusCode.ERROR
        message: 'Network error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.type', 'Error');
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('extracts port from URL', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com:8443/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP GET',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'server.port': 8443,
          }),
        }),
      );
    });

    it('uses default port for HTTPS', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP GET',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'server.port': 443,
          }),
        }),
      );
    });

    it('handles string body size calculation', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/text',
        method: 'POST',
        headers: {},
        body: 'Hello, World!',
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'http.request.body.size',
        13, // "Hello, World!" length
      );
    });

    it('handles ArrayBuffer body size calculation', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      const buffer = new ArrayBuffer(1024);

      const ctx: RequestContext = {
        url: 'https://api.example.com/binary',
        method: 'POST',
        headers: {},
        body: buffer,
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.body.size', 1024);
    });

    it('handles Uint8Array body size calculation', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      const array = new Uint8Array(512);

      const ctx: RequestContext = {
        url: 'https://api.example.com/binary',
        method: 'POST',
        headers: {},
        body: array,
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.body.size', 512);
    });

    it('ends span even when request succeeds', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockSpan.end).toHaveBeenCalledTimes(1);
    });

    it('handles invalid URL gracefully', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'not-a-valid-url',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP GET',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'server.address': 'unknown',
          }),
        }),
      );
    });

    it('handles circular reference in body (JSON.stringify fails)', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      // Create a circular reference
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj['self'] = circularObj;

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        body: circularObj,
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      // Should not throw, just skip body size recording
      await policy(ctx, mockNext as NextFn);

      // Body size should not be recorded (JSON.stringify failed)
      const setAttributeCalls = (mockSpan.setAttribute as ReturnType<typeof vi.fn>).mock.calls;
      const bodySizeCall = setAttributeCalls.find((call: string[]) => call[0] === 'http.request.body.size');
      expect(bodySizeCall).toBeUndefined();
    });

    it('handles non-Error exceptions', async () => {
      const policy = otel({ tracer: mockTracer as Tracer });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockRejectedValue('string error');

      await expect(policy(ctx, mockNext as NextFn)).rejects.toBe('string error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2, // SpanStatusCode.ERROR
        message: 'Unknown error',
      });
      // recordException should not be called for non-Error
      expect(mockSpan.recordException).not.toHaveBeenCalled();
    });

    it('skips propagation when disabled', async () => {
      const { propagation } = await import('@opentelemetry/api');

      const policy = otel({
        tracer: mockTracer as Tracer,
        propagateContext: false,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      // propagation.inject should not be called
      expect(propagation.inject).not.toHaveBeenCalled();
    });

    it('does not record body size for unsupported types', async () => {
      const policy = otel({
        tracer: mockTracer as Tracer,
        recordRequestBodySize: true,
      });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        body: 12345, // number - not a supported type for size calculation
      };

      mockNext.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      });

      await policy(ctx, mockNext as NextFn);

      // Body size should not be recorded for unsupported types
      const setAttributeCalls = (mockSpan.setAttribute as ReturnType<typeof vi.fn>).mock.calls;
      const bodySizeCall = setAttributeCalls.find((call: string[]) => call[0] === 'http.request.body.size');
      expect(bodySizeCall).toBeUndefined();
    });
  });
});
