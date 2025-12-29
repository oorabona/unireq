/**
 * Structured audit logging for security events (OWASP A09:2021)
 *
 * @see https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/
 */

import { randomUUID } from 'node:crypto';
import { policy } from './introspection.js';
import type { Logger, Policy, RequestContext, Response } from './types.js';

/**
 * Security event types for audit logging
 */
export type SecurityEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'auth_token_refresh'
  | 'auth_token_expired'
  | 'access_denied'
  | 'rate_limit_exceeded'
  | 'validation_failure'
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'suspicious_activity';

/**
 * Structured audit log entry
 */
export interface AuditLogEntry {
  /** ISO 8601 timestamp */
  readonly timestamp: string;
  /** Unique correlation ID for request tracing */
  readonly correlationId: string;
  /** Security event type */
  readonly eventType: SecurityEventType;
  /** Event severity level */
  readonly severity: 'info' | 'warn' | 'error' | 'critical';
  /** HTTP method */
  readonly method: string;
  /** Request URL (sanitized) */
  readonly url: string;
  /** HTTP status code (if available) */
  readonly statusCode?: number;
  /** Request duration in milliseconds */
  readonly durationMs?: number;
  /** Client IP address (if available) */
  readonly clientIp?: string;
  /** User agent (if available) */
  readonly userAgent?: string;
  /** User ID or identifier (if authenticated) */
  readonly userId?: string;
  /** Session ID (if available) */
  readonly sessionId?: string;
  /** Additional context */
  readonly context?: Record<string, unknown>;
  /** Error message (sanitized, no stack traces) */
  readonly errorMessage?: string;
  /** Error code */
  readonly errorCode?: string;
}

/**
 * Audit logger interface
 */
export interface AuditLogger {
  readonly log: (entry: AuditLogEntry) => void | Promise<void>;
}

/**
 * Audit logging options
 */
export interface AuditOptions {
  /** Audit logger implementation */
  readonly logger: AuditLogger;
  /** Function to extract user ID from context */
  readonly getUserId?: (ctx: RequestContext) => string | undefined;
  /** Function to extract session ID from context */
  readonly getSessionId?: (ctx: RequestContext) => string | undefined;
  /** Function to extract client IP from context */
  readonly getClientIp?: (ctx: RequestContext) => string | undefined;
  /** Headers to redact from logs */
  readonly redactHeaders?: ReadonlyArray<string>;
  /** Log successful requests (default: true) */
  readonly logSuccess?: boolean;
  /** Log request bodies (default: false) */
  readonly logBody?: boolean;
  /** Custom correlation ID generator */
  readonly correlationIdGenerator?: () => string;
  /** Suspicious activity detector */
  readonly detectSuspiciousActivity?: (ctx: RequestContext, response?: Response, error?: Error) => boolean;
}

/**
 * Default headers to redact for security
 */
const DEFAULT_REDACT_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-session-id',
];

/**
 * Generate a correlation ID using cryptographically secure random
 */
function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Sanitize URL by removing sensitive query parameters
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitiveParams = ['token', 'api_key', 'apikey', 'secret', 'password', 'auth'];

    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Get severity based on status code
 */
function getSeverityFromStatus(status: number): 'info' | 'warn' | 'error' | 'critical' {
  if (status >= 500) return 'error';
  if (status === 401 || status === 403) return 'warn';
  if (status >= 400) return 'warn';
  return 'info';
}

/**
 * Creates a structured audit logging policy (OWASP A09:2021)
 *
 * Provides comprehensive security event logging with:
 * - Structured JSON format
 * - Correlation IDs for request tracing
 * - Sensitive data redaction
 * - Security event classification
 * - Suspicious activity detection
 *
 * @param options - Audit logging configuration
 * @returns Policy that logs security events
 *
 * @example
 * ```ts
 * const auditLogger: AuditLogger = {
 *   log: (entry) => console.log(JSON.stringify(entry)),
 * };
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   audit({
 *     logger: auditLogger,
 *     getUserId: (ctx) => ctx.headers['x-user-id'],
 *   }),
 *   parse.json()
 * );
 * ```
 */
export function audit(options: AuditOptions): Policy {
  const {
    logger,
    getUserId,
    getSessionId,
    getClientIp,
    redactHeaders = DEFAULT_REDACT_HEADERS,
    logSuccess = true,
    correlationIdGenerator = generateCorrelationId,
    detectSuspiciousActivity,
  } = options;

  return policy(
    async (ctx, next) => {
      const correlationId = correlationIdGenerator();
      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      // Extract context information
      const userId = getUserId?.(ctx);
      const sessionId = getSessionId?.(ctx);
      const clientIp = getClientIp?.(ctx);
      const userAgent = ctx.headers['user-agent'];

      // Log request started
      await logger.log({
        timestamp,
        correlationId,
        eventType: 'request_started',
        severity: 'info',
        method: ctx.method,
        url: sanitizeUrl(ctx.url),
        userId,
        sessionId,
        clientIp,
        userAgent,
      });

      try {
        const response = await next(ctx);
        const durationMs = Date.now() - startTime;

        // Determine event type based on response
        let eventType: SecurityEventType = 'request_completed';
        let severity = getSeverityFromStatus(response.status);

        if (response.status === 401) {
          eventType = 'auth_failure';
          severity = 'warn';
        } else if (response.status === 403) {
          eventType = 'access_denied';
          severity = 'warn';
        } else if (response.status === 429) {
          eventType = 'rate_limit_exceeded';
          severity = 'warn';
        }

        // Check for suspicious activity
        if (detectSuspiciousActivity?.(ctx, response, undefined)) {
          eventType = 'suspicious_activity';
          severity = 'critical';
        }

        // Log completion (unless it's a success and logSuccess is false)
        if (logSuccess || response.status >= 400) {
          await logger.log({
            timestamp: new Date().toISOString(),
            correlationId,
            eventType,
            severity,
            method: ctx.method,
            url: sanitizeUrl(ctx.url),
            statusCode: response.status,
            durationMs,
            userId,
            sessionId,
            clientIp,
            userAgent,
          });
        }

        return response;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        // Check for suspicious activity
        let eventType: SecurityEventType = 'request_failed';
        let severity: 'error' | 'critical' = 'error';

        if (detectSuspiciousActivity?.(ctx, undefined, err)) {
          eventType = 'suspicious_activity';
          severity = 'critical';
        }

        // Log failure with sanitized error message (no stack trace)
        await logger.log({
          timestamp: new Date().toISOString(),
          correlationId,
          eventType,
          severity,
          method: ctx.method,
          url: sanitizeUrl(ctx.url),
          durationMs,
          userId,
          sessionId,
          clientIp,
          userAgent,
          errorMessage: err.message,
          errorCode: (err as { code?: string }).code,
        });

        throw error;
      }
    },
    {
      name: 'audit',
      kind: 'other',
      options: {
        logSuccess,
        redactHeaders,
      },
    },
  );
}

/**
 * Creates a console-based audit logger for development
 * @returns AuditLogger that logs to console in JSON format
 */
export function createConsoleAuditLogger(): AuditLogger {
  return {
    log: (entry) => {
      console.log(JSON.stringify(entry));
    },
  };
}

/**
 * Creates an audit logger that uses a standard Logger interface
 * @param logger - Standard logger implementation
 * @returns AuditLogger that delegates to the standard logger
 */
export function createLoggerAdapter(logger: Logger): AuditLogger {
  return {
    log: (entry) => {
      const message = `[${entry.eventType}] ${entry.method} ${entry.url}`;
      const meta: Record<string, unknown> = { ...entry };

      switch (entry.severity) {
        case 'critical':
        case 'error':
          logger.error(message, meta);
          break;
        case 'warn':
          logger.warn(message, meta);
          break;
        default:
          logger.info(message, meta);
      }
    },
  };
}
