/**
 * Serialization middleware for BodyDescriptor handling
 */

import type { BodyDescriptor, Policy } from './types.js';

/**
 * Type guard to check if a value is a BodyDescriptor
 * @param value - Value to check
 * @returns True if value is a BodyDescriptor
 */
export function isBodyDescriptor(value: unknown): value is BodyDescriptor {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__brand' in value &&
    (value as BodyDescriptor).__brand === 'BodyDescriptor' &&
    'serialize' in value &&
    typeof (value as BodyDescriptor).serialize === 'function'
  );
}

/**
 * Serialization policy that converts BodyDescriptor to serialized form
 * This middleware should be applied first in the policy chain to handle
 * body descriptors before other policies process the request
 *
 * @returns Policy that handles BodyDescriptor serialization
 */
export function serializationPolicy(): Policy {
  return async (ctx, next) => {
    // Check if body is a BodyDescriptor
    if (isBodyDescriptor(ctx.body)) {
      const descriptor = ctx.body;

      // Serialize the body
      const serialized = descriptor.serialize();

      // Create updated context with serialized body and Content-Type header
      // IMPORTANT: For FormData, we must NOT set Content-Type manually
      // because fetch needs to set it with the correct boundary
      const shouldSetContentType =
        descriptor.contentType &&
        !ctx.headers['content-type'] &&
        !ctx.headers['Content-Type'] &&
        !(serialized instanceof FormData); // Let fetch handle FormData Content-Type

      const updatedCtx = {
        ...ctx,
        body: serialized,
        headers: {
          ...ctx.headers,
          ...(shouldSetContentType ? { 'content-type': descriptor.contentType } : {}),
        },
      };

      return next(updatedCtx);
    }

    // Not a BodyDescriptor, pass through unchanged
    return next(ctx);
  };
}
