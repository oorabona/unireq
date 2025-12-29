/**
 * @unireq/core - Logging policy tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '../logging.js';
import type { Logger, RequestContext, Response } from '../types.js';

describe('@unireq/core - log', () => {
  const mockLogger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNext = async (_ctx: RequestContext): Promise<Response> => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { success: true },
    ok: true,
  });

  const mockContext: RequestContext = {
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: {
      authorization: 'Bearer secret',
      'x-api-key': '12345',
      accept: 'application/json',
    },
  };

  it('should log request start and completion', async () => {
    const policy = log({ logger: mockLogger });
    await policy(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('started'),
      expect.objectContaining({
        method: 'GET',
        url: 'https://api.example.com/users',
      }),
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('completed'),
      expect.objectContaining({
        status: 200,
      }),
    );
  });

  it('should redact sensitive headers by default', async () => {
    const policy = log({ logger: mockLogger });
    await policy(mockContext, mockNext);

    const startLog = (mockLogger.info as any).mock.calls[0][1];
    expect(startLog.headers['authorization']).toBe('[REDACTED]');
    expect(startLog.headers['x-api-key']).toBe('[REDACTED]');
    expect(startLog.headers['accept']).toBe('application/json');
  });

  it('should support custom redacted headers', async () => {
    const policy = log({
      logger: mockLogger,
      redactHeaders: ['accept'],
    });
    await policy(mockContext, mockNext);

    const startLog = (mockLogger.info as any).mock.calls[0][1];
    expect(startLog.headers['accept']).toBe('[REDACTED]');
    expect(startLog.headers['authorization']).toBe('Bearer secret');
  });

  it('should log body when enabled', async () => {
    const policy = log({
      logger: mockLogger,
      logBody: true,
    });

    const ctxWithBody = { ...mockContext, body: { foo: 'bar' } };
    await policy(ctxWithBody, mockNext);

    const startLog = (mockLogger.info as any).mock.calls[0][1];
    const endLog = (mockLogger.info as any).mock.calls[1][1];

    expect(startLog.body).toEqual({ foo: 'bar' });
    expect(endLog.data).toEqual({ success: true });
  });

  it('should log errors', async () => {
    const error = new Error('Network failure');
    const failingNext = async () => {
      throw error;
    };

    const policy = log({ logger: mockLogger });

    await expect(policy(mockContext, failingNext)).rejects.toThrow('Network failure');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({
        error,
      }),
    );
  });
});
