/**
 * Request/Response Interceptors
 * @see https://github.com/axios/axios#interceptors
 * @see https://github.com/sindresorhus/ky#hooks
 */

import type { Policy, RequestContext, Response } from '@unireq/core';

/**
 * Request interceptor - executes before request is sent
 * Can modify request context or abort the request
 * @param ctx - Request context
 * @returns Modified request context or void
 */
export type RequestInterceptor = (ctx: RequestContext) => RequestContext | Promise<RequestContext>;

/**
 * Response interceptor - executes after response is received
 * Can modify response or throw errors
 * @param response - Response object
 * @param ctx - Request context that generated this response
 * @returns Modified response or void
 */
export type ResponseInterceptor<T = unknown> = (
  response: Response<T>,
  ctx: RequestContext,
) => Response<T> | Promise<Response<T>>;

/**
 * Error interceptor - executes when request fails
 * Can recover from errors or rethrow
 * @param error - Error that occurred
 * @param ctx - Request context that generated this error
 * @returns Response to use instead of error, or rethrows
 */
export type ErrorInterceptor<T = unknown> = (error: unknown, ctx: RequestContext) => Response<T> | Promise<Response<T>>;

/**
 * Creates a policy from a request interceptor
 * Runs before the request is sent
 *
 * @param interceptor - Request interceptor function
 * @returns Policy that applies the interceptor
 *
 * @example
 * ```typescript
 * // Logging interceptor
 * const logRequest = interceptRequest((ctx) => {
 *   console.log(`${ctx.method} ${ctx.url}`);
 *   return ctx;
 * });
 *
 * // Auth token interceptor
 * const addAuth = interceptRequest(async (ctx) => ({
 *   ...ctx,
 *   headers: { ...ctx.headers, authorization: `Bearer ${await getToken()}` }
 * }));
 * ```
 */
export function interceptRequest(interceptor: RequestInterceptor): Policy {
  return async (ctx, next) => {
    const modifiedCtx = await interceptor(ctx);
    return next(modifiedCtx);
  };
}

/**
 * Creates a policy from a response interceptor
 * Runs after the response is received
 *
 * @param interceptor - Response interceptor function
 * @returns Policy that applies the interceptor
 *
 * @example
 * ```typescript
 * // Logging interceptor
 * const logResponse = interceptResponse((response, ctx) => {
 *   console.log(`${ctx.method} ${ctx.url} -> ${response.status}`);
 *   return response;
 * });
 *
 * // Response transformation
 * const addMetadata = interceptResponse((response) => ({
 *   ...response,
 *   data: { ...response.data, receivedAt: Date.now() }
 * }));
 * ```
 */
export function interceptResponse<T = unknown>(interceptor: ResponseInterceptor<T>): Policy {
  return async (ctx, next) => {
    const response = await next(ctx);
    return interceptor(response as Response<T>, ctx);
  };
}

/**
 * Creates a policy from an error interceptor
 * Runs when request fails
 *
 * @param interceptor - Error interceptor function
 * @returns Policy that applies the interceptor
 *
 * @example
 * ```typescript
 * // Retry on 5xx errors
 * const retryOn5xx = interceptError(async (error, ctx) => {
 *   if (error instanceof Response && error.status >= 500) {
 *     console.log('Retrying after 5xx error...');
 *     // Retry logic here
 *   }
 *   throw error;
 * });
 *
 * // Global error handling
 * const handleErrors = interceptError((error, ctx) => {
 *   console.error(`Request failed: ${ctx.method} ${ctx.url}`, error);
 *   throw error;
 * });
 * ```
 */
export function interceptError<T = unknown>(interceptor: ErrorInterceptor<T>): Policy {
  return async (ctx, next) => {
    try {
      return await next(ctx);
    } catch (error) {
      return interceptor(error, ctx);
    }
  };
}

/**
 * Combines multiple request interceptors into a single policy
 * Interceptors are executed in order
 *
 * @param interceptors - Array of request interceptors
 * @returns Policy that applies all interceptors
 *
 * @example
 * ```typescript
 * const requestPipeline = combineRequestInterceptors(
 *   logRequest,
 *   addAuth,
 *   validateRequest
 * );
 * ```
 */
export function combineRequestInterceptors(...interceptors: RequestInterceptor[]): Policy {
  return async (ctx, next) => {
    let currentCtx = ctx;
    for (const interceptor of interceptors) {
      currentCtx = await interceptor(currentCtx);
    }
    return next(currentCtx);
  };
}

/**
 * Combines multiple response interceptors into a single policy
 * Interceptors are executed in order
 *
 * @param interceptors - Array of response interceptors
 * @returns Policy that applies all interceptors
 *
 * @example
 * ```typescript
 * const responsePipeline = combineResponseInterceptors(
 *   logResponse,
 *   addMetadata,
 *   validateResponse
 * );
 * ```
 */
export function combineResponseInterceptors<T = unknown>(...interceptors: ResponseInterceptor<T>[]): Policy {
  return async (ctx, next) => {
    let response = await next(ctx);
    for (const interceptor of interceptors) {
      response = await interceptor(response as Response<T>, ctx);
    }
    return response;
  };
}
