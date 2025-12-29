/**
 * DX-focused error types for unireq
 */

import type { Response } from './types.js';

/** Base error class for unireq */
export class UnireqError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UnireqError';
  }
}

/** Error thrown when a network request fails (e.g. DNS, connection refused) */
export class NetworkError extends UnireqError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'NetworkError';
  }
}

/** Error thrown when a request times out */
export class TimeoutError extends UnireqError {
  constructor(
    public readonly timeoutMs: number,
    cause?: unknown,
  ) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT', cause);
    this.name = 'TimeoutError';
  }
}

/** Error thrown when an HTTP response has an error status code (4xx, 5xx) */
export class HttpError extends UnireqError {
  public readonly status: number;
  public readonly statusText: string;
  public readonly headers: Record<string, string | string[] | undefined>;
  public readonly data: unknown;

  constructor(response: Response) {
    super(`HTTP Error ${response.status}: ${response.statusText}`, 'HTTP_ERROR');
    this.name = 'HttpError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.data = response.data;
  }
}

/** Error thrown when serialization or parsing fails */
export class SerializationError extends UnireqError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SERIALIZATION_ERROR', cause);
    this.name = 'SerializationError';
  }
}

/** Error thrown when duplicate policies are detected */
export class DuplicatePolicyError extends UnireqError {
  constructor(public readonly policyName: string) {
    super(
      `Duplicate policy detected: ${policyName}. Each policy can only be registered once in the chain.`,
      'DUPLICATE_POLICY',
    );
    this.name = 'DuplicatePolicyError';
  }
}

/** Error thrown when authentication is not supported by transport */
export class UnsupportedAuthForTransport extends UnireqError {
  constructor(
    public readonly authType: string,
    public readonly transportType: string,
  ) {
    super(`Authentication type "${authType}" is not supported by transport "${transportType}".`, 'UNSUPPORTED_AUTH');
    this.name = 'UnsupportedAuthForTransport';
  }
}

/** HTTP 406 Not Acceptable error */
export class NotAcceptableError extends UnireqError {
  constructor(
    public readonly acceptedTypes: ReadonlyArray<string>,
    public readonly receivedType?: string,
  ) {
    const received = receivedType ? ` (received: ${receivedType})` : '';
    super(
      `Server cannot produce a response matching the Accept header. Accepted types: ${acceptedTypes.join(', ')}${received}`,
      'NOT_ACCEPTABLE',
    );
    this.name = 'NotAcceptableError';
  }
}

/** HTTP 415 Unsupported Media Type error */
export class UnsupportedMediaTypeError extends UnireqError {
  constructor(
    public readonly supportedTypes: ReadonlyArray<string>,
    public readonly sentType?: string,
  ) {
    const sent = sentType ? ` (sent: ${sentType})` : '';
    super(
      `Server cannot process the request payload media type. Supported types: ${supportedTypes.join(', ')}${sent}`,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    this.name = 'UnsupportedMediaTypeError';
  }
}

/** Error thrown when required capability is missing */
export class MissingCapabilityError extends UnireqError {
  constructor(
    public readonly capability: string,
    public readonly transportType: string,
  ) {
    super(`Transport "${transportType}" does not support required capability: ${capability}`, 'MISSING_CAPABILITY');
    this.name = 'MissingCapabilityError';
  }
}

/** Error thrown for invalid slot configuration */
export class InvalidSlotError extends UnireqError {
  constructor(
    public readonly slotType: string,
    message: string,
  ) {
    super(`Invalid slot configuration for ${slotType}: ${message}`, 'INVALID_SLOT');
    this.name = 'InvalidSlotError';
  }
}

/** Error thrown when URL normalization fails */
export class URLNormalizationError extends UnireqError {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`Failed to normalize URL "${url}": ${reason}`, 'URL_NORMALIZATION_FAILED');
    this.name = 'URLNormalizationError';
  }
}
