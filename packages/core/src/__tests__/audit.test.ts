/**
 * Audit logging tests (OWASP A09:2021)
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type AuditLogEntry,
  type AuditLogger,
  audit,
  createConsoleAuditLogger,
  createLoggerAdapter,
} from '../audit.js';
import { createMockContext, createMockLogger, createMockResponse } from './helpers.js';

describe('@unireq/core - Audit logging', () => {
  const createMockAuditLogger = (): AuditLogger & { entries: AuditLogEntry[] } => {
    const entries: AuditLogEntry[] = [];
    return {
      entries,
      log: (entry) => {
        entries.push(entry);
      },
    };
  };

  describe('audit policy', () => {
    it('should log request started and completed events', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext({ method: 'GET', url: 'https://api.example.com/users' });
      const response = createMockResponse({ status: 200 });

      await policy(ctx, async () => response);

      expect(logger.entries).toHaveLength(2);

      // Request started
      expect(logger.entries[0]?.eventType).toBe('request_started');
      expect(logger.entries[0]?.method).toBe('GET');
      expect(logger.entries[0]?.url).toBe('https://api.example.com/users');
      expect(logger.entries[0]?.severity).toBe('info');
      expect(logger.entries[0]?.correlationId).toBeDefined();
      expect(logger.entries[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Request completed
      expect(logger.entries[1]?.eventType).toBe('request_completed');
      expect(logger.entries[1]?.statusCode).toBe(200);
      expect(logger.entries[1]?.durationMs).toBeDefined();
      expect(logger.entries[1]?.correlationId).toBe(logger.entries[0]?.correlationId);
    });

    it('should log auth_failure event for 401 status', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 401 });

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.eventType).toBe('auth_failure');
      expect(logger.entries[1]?.severity).toBe('warn');
    });

    it('should log access_denied event for 403 status', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 403 });

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.eventType).toBe('access_denied');
      expect(logger.entries[1]?.severity).toBe('warn');
    });

    it('should log rate_limit_exceeded event for 429 status', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 429 });

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.eventType).toBe('rate_limit_exceeded');
      expect(logger.entries[1]?.severity).toBe('warn');
    });

    it('should log request_failed event on error', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();

      await expect(
        policy(ctx, async () => {
          throw new Error('Connection failed');
        }),
      ).rejects.toThrow('Connection failed');

      expect(logger.entries).toHaveLength(2);
      expect(logger.entries[1]?.eventType).toBe('request_failed');
      expect(logger.entries[1]?.severity).toBe('error');
      expect(logger.entries[1]?.errorMessage).toBe('Connection failed');
    });

    it('should sanitize sensitive query parameters in URL', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext({
        url: 'https://api.example.com/auth?token=secret123&apikey=key456&name=test',
      });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.url).toContain('token=%5BREDACTED%5D');
      expect(logger.entries[0]?.url).toContain('apikey=%5BREDACTED%5D');
      expect(logger.entries[0]?.url).toContain('name=test');
      expect(logger.entries[0]?.url).not.toContain('secret123');
      expect(logger.entries[0]?.url).not.toContain('key456');
    });

    it('should extract user ID from context', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        getUserId: (ctx) => ctx.headers['x-user-id'],
      });

      const ctx = createMockContext({
        headers: { 'x-user-id': 'user-123' },
      });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.userId).toBe('user-123');
      expect(logger.entries[1]?.userId).toBe('user-123');
    });

    it('should extract session ID from context', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        getSessionId: (ctx) => ctx.headers['x-session-id'],
      });

      const ctx = createMockContext({
        headers: { 'x-session-id': 'session-abc' },
      });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.sessionId).toBe('session-abc');
    });

    it('should extract client IP from context', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        getClientIp: (ctx) => ctx.headers['x-forwarded-for'],
      });

      const ctx = createMockContext({
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.clientIp).toBe('192.168.1.1');
    });

    it('should extract user agent from context', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext({
        headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
      });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.userAgent).toBe('Mozilla/5.0 TestBrowser');
    });

    it('should skip success logging when logSuccess is false', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger, logSuccess: false });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 200 });

      await policy(ctx, async () => response);

      // Only request_started should be logged
      expect(logger.entries).toHaveLength(1);
      expect(logger.entries[0]?.eventType).toBe('request_started');
    });

    it('should still log errors when logSuccess is false', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger, logSuccess: false });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 500 });

      await policy(ctx, async () => response);

      expect(logger.entries).toHaveLength(2);
      expect(logger.entries[1]?.statusCode).toBe(500);
    });

    it('should use custom correlation ID generator', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        correlationIdGenerator: () => 'custom-correlation-id-123',
      });

      const ctx = createMockContext();
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[0]?.correlationId).toBe('custom-correlation-id-123');
      expect(logger.entries[1]?.correlationId).toBe('custom-correlation-id-123');
    });

    it('should detect suspicious activity', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        detectSuspiciousActivity: (ctx) => {
          // Flag requests with suspicious patterns
          return ctx.url.includes('admin') || ctx.url.includes('../../');
        },
      });

      const ctx = createMockContext({ url: 'https://api.example.com/admin/secrets' });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.eventType).toBe('suspicious_activity');
      expect(logger.entries[1]?.severity).toBe('critical');
    });

    it('should detect suspicious activity on error', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({
        logger,
        detectSuspiciousActivity: (_ctx, _response, error) => {
          return error?.message.includes('injection') ?? false;
        },
      });

      const ctx = createMockContext();

      await expect(
        policy(ctx, async () => {
          throw new Error('SQL injection detected');
        }),
      ).rejects.toThrow();

      expect(logger.entries[1]?.eventType).toBe('suspicious_activity');
      expect(logger.entries[1]?.severity).toBe('critical');
    });

    it('should calculate duration correctly', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse();

      const start = Date.now();
      await policy(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return response;
      });
      const elapsed = Date.now() - start;

      // Allow for timing variations - duration should be roughly between delay and elapsed time
      expect(logger.entries[1]?.durationMs).toBeGreaterThanOrEqual(10);
      expect(logger.entries[1]?.durationMs).toBeLessThanOrEqual(elapsed + 10);
    });

    it('should handle non-Error throws', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();

      await expect(
        policy(ctx, async () => {
          throw 'string error';
        }),
      ).rejects.toBe('string error');

      expect(logger.entries[1]?.errorMessage).toBe('string error');
    });

    it('should include error code if available', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const error = new Error('Network error') as Error & { code: string };
      error.code = 'ECONNREFUSED';

      await expect(
        policy(ctx, async () => {
          throw error;
        }),
      ).rejects.toThrow();

      expect(logger.entries[1]?.errorCode).toBe('ECONNREFUSED');
    });

    it('should handle invalid URLs gracefully', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext({ url: 'not-a-valid-url' });
      const response = createMockResponse();

      await policy(ctx, async () => response);

      // Should not crash, URL passed through as-is
      expect(logger.entries[0]?.url).toBe('not-a-valid-url');
    });
  });

  describe('createConsoleAuditLogger', () => {
    it('should log to console as JSON', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = createConsoleAuditLogger();
      const entry: AuditLogEntry = {
        timestamp: '2025-01-01T00:00:00.000Z',
        correlationId: 'test-123',
        eventType: 'request_completed',
        severity: 'info',
        method: 'GET',
        url: 'https://example.com',
        statusCode: 200,
      };

      logger.log(entry);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(entry));

      consoleSpy.mockRestore();
    });
  });

  describe('createLoggerAdapter', () => {
    it('should delegate info severity to logger.info', () => {
      const mockLogger = createMockLogger();
      const adapter = createLoggerAdapter(mockLogger);

      adapter.log({
        timestamp: '2025-01-01T00:00:00.000Z',
        correlationId: 'test-123',
        eventType: 'request_completed',
        severity: 'info',
        method: 'GET',
        url: 'https://example.com',
      });

      expect(mockLogger.calls).toHaveLength(1);
      expect(mockLogger.calls[0]?.level).toBe('info');
    });

    it('should delegate warn severity to logger.warn', () => {
      const mockLogger = createMockLogger();
      const adapter = createLoggerAdapter(mockLogger);

      adapter.log({
        timestamp: '2025-01-01T00:00:00.000Z',
        correlationId: 'test-123',
        eventType: 'auth_failure',
        severity: 'warn',
        method: 'POST',
        url: 'https://example.com/login',
      });

      expect(mockLogger.calls[0]?.level).toBe('warn');
    });

    it('should delegate error severity to logger.error', () => {
      const mockLogger = createMockLogger();
      const adapter = createLoggerAdapter(mockLogger);

      adapter.log({
        timestamp: '2025-01-01T00:00:00.000Z',
        correlationId: 'test-123',
        eventType: 'request_failed',
        severity: 'error',
        method: 'GET',
        url: 'https://example.com',
      });

      expect(mockLogger.calls[0]?.level).toBe('error');
    });

    it('should delegate critical severity to logger.error', () => {
      const mockLogger = createMockLogger();
      const adapter = createLoggerAdapter(mockLogger);

      adapter.log({
        timestamp: '2025-01-01T00:00:00.000Z',
        correlationId: 'test-123',
        eventType: 'suspicious_activity',
        severity: 'critical',
        method: 'GET',
        url: 'https://example.com',
      });

      expect(mockLogger.calls[0]?.level).toBe('error');
    });
  });

  describe('Severity determination', () => {
    it('should set error severity for 5xx status codes', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 503 });

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.severity).toBe('error');
    });

    it('should set warn severity for 4xx status codes', async () => {
      const logger = createMockAuditLogger();
      const policy = audit({ logger });

      const ctx = createMockContext();
      const response = createMockResponse({ status: 404 });

      await policy(ctx, async () => response);

      expect(logger.entries[1]?.severity).toBe('warn');
    });
  });
});
