/**
 * Core types for the unireq framework
 */

import type { Result } from './result.js';

/** Request context passed through the policy chain */
export interface RequestContext {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly policies?: ReadonlyArray<Policy>;
  readonly [key: string]: unknown;
}

/** Response from a transport or policy */
export interface Response<T = unknown> {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: T;
  readonly ok: boolean;
}

/** Policy function that transforms request context */
export type Policy = (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => Promise<Response>;

/** Transport capabilities declaration */
export interface TransportCapabilities {
  readonly streams?: boolean;
  readonly multipartFormData?: boolean;
  readonly randomAccess?: boolean;
  readonly [key: string]: boolean | undefined;
}

/** Connector interface for pluggable transport implementations */
export interface Connector<TClient = unknown> {
  connect(uri: string): Promise<TClient> | TClient;
  request(client: TClient, ctx: RequestContext): Promise<Response>;
  disconnect(client: TClient): Promise<void> | void;
}

/** Transport function that executes the actual I/O */
export type Transport = (ctx: RequestContext) => Promise<Response>;

/** Transport with capabilities metadata */
export interface TransportWithCapabilities {
  readonly transport: Transport;
  readonly capabilities: TransportCapabilities;
}

/** Slot types for compile/runtime checks */
export enum SlotType {
  Transport = 'transport',
  Auth = 'auth',
  Parser = 'parser',
}

/** Slot metadata for policy registration */
export interface SlotMetadata {
  readonly type: SlotType;
  readonly name: string;
  readonly requiredCapabilities?: ReadonlyArray<string>;
}

/** Client configuration options */
export interface ClientOptions {
  readonly base?: string;
  readonly defaultScheme?: 'http' | 'https' | 'ftp' | 'imap';
  readonly policies?: ReadonlyArray<Policy>;
}

/**
 * Per-request options for client methods
 * Allows passing body, policies, and signal in a structured way
 *
 * @example
 * ```ts
 * // Using options object
 * await client.post('/users', {
 *   body: { name: 'Alice' },
 *   policies: [timeout(5000)],
 *   signal: AbortSignal.timeout(10000),
 * });
 *
 * // Equivalent to variadic API
 * await client.post('/users', { name: 'Alice' }, timeout(5000));
 * ```
 */
export interface RequestOptions {
  /** Request body (for POST, PUT, PATCH) */
  readonly body?: unknown;
  /** Per-request policies to compose with client-level policies */
  readonly policies?: ReadonlyArray<Policy>;
  /** AbortSignal for request cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Safe client methods that return Result<Response<T>, Error> instead of throwing
 *
 * @example
 * ```ts
 * const result = await client.safe.get<User>('/users/1');
 *
 * // Pattern matching
 * result.match({
 *   ok: (response) => console.log(response.data),
 *   err: (error) => console.error(error.message),
 * });
 *
 * // Chaining
 * const name = result
 *   .map(r => r.data)
 *   .map(user => user.name)
 *   .unwrapOr('Unknown');
 * ```
 */
export interface SafeClient {
  readonly request: <T = unknown>(
    url: string,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly get: <T = unknown>(
    url: string,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly head: <T = unknown>(
    url: string,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly post: <T = unknown>(
    url: string,
    body?: unknown,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly put: <T = unknown>(
    url: string,
    body?: unknown,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly delete: <T = unknown>(
    url: string,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly patch: <T = unknown>(
    url: string,
    body?: unknown,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
  readonly options: <T = unknown>(
    url: string,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Result<Response<T>, Error>>;
}

/** Client instance */
export interface Client {
  readonly request: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly get: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly head: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly post: <T = unknown>(url: string, body?: unknown, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly put: <T = unknown>(url: string, body?: unknown, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly delete: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  readonly patch: <T = unknown>(
    url: string,
    body?: unknown,
    ...policies: ReadonlyArray<Policy>
  ) => Promise<Response<T>>;
  readonly options: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  /** Safe methods that return Result instead of throwing */
  readonly safe: SafeClient;
}

/** Predicate function for conditional branching */
export type Predicate<T = unknown> = (ctx: RequestContext) => T | Promise<T>;

/** Either branch configuration */
export interface EitherBranch<T> {
  readonly predicate: Predicate<T>;
  readonly then: Policy;
  readonly else?: Policy;
}

/** Body descriptor for request serialization */
export interface BodyDescriptor {
  readonly __brand: 'BodyDescriptor';
  readonly data: unknown;
  readonly contentType?: string;
  readonly serialize: () => string | Blob | ArrayBuffer | FormData | ReadableStream<Uint8Array>;
  readonly filename?: string;
  readonly contentLength?: number;
}

/** Multipart part configuration */
export interface MultipartPart {
  readonly name: string;
  readonly part: BodyDescriptor;
  readonly filename?: string;
}

/** Logger interface for structured logging */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
