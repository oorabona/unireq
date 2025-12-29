/**
 * Logging policy
 */

import { randomUUID } from 'node:crypto';
import { policy } from './introspection.js';
import type { Logger, Policy } from './types.js';

export interface LogOptions {
  readonly logger: Logger;
  readonly redactHeaders?: ReadonlyArray<string>;
  readonly logBody?: boolean;
}

const DEFAULT_REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

export function log(options: LogOptions): Policy {
  const { logger, redactHeaders = DEFAULT_REDACT_HEADERS, logBody = false } = options;

  const redact = (headers: Record<string, string>): Record<string, string> => {
    const redacted = { ...headers };
    for (const header of redactHeaders) {
      const key = Object.keys(redacted).find((k) => k.toLowerCase() === header.toLowerCase());
      if (key) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  };

  return policy(
    async (ctx, next) => {
      const start = Date.now();
      const requestId = randomUUID();

      logger.info(`Request ${requestId} started`, {
        requestId,
        method: ctx.method,
        url: ctx.url,
        headers: redact(ctx.headers),
        body: logBody ? ctx.body : undefined,
      });

      try {
        const response = await next(ctx);
        const duration = Date.now() - start;

        logger.info(`Request ${requestId} completed`, {
          requestId,
          status: response.status,
          duration,
          headers: redact(response.headers),
          data: logBody ? response.data : undefined,
        });

        return response;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`Request ${requestId} failed`, {
          requestId,
          duration,
          error,
        });
        throw error;
      }
    },
    {
      name: 'log',
      kind: 'other',
      options: { redactHeaders, logBody },
    },
  );
}
