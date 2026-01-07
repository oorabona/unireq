/**
 * @unireq/core - Core client and composition utilities
 */

// Audit logging (OWASP A09)
export type { AuditLogEntry, AuditLogger, AuditOptions, SecurityEventType } from './audit.js';
export { audit, createConsoleAuditLogger, createLoggerAdapter } from './audit.js';
export type { BackoffOptions } from './backoff.js';
export { backoff } from './backoff.js';
export * from './circuit-breaker.js';
// Client
export { client } from './client.js';
// Composition utilities
export { compose } from './compose.js';
export { either, match } from './either.js';
// Errors
export {
  DuplicatePolicyError,
  HttpError,
  InvalidSlotError,
  MissingCapabilityError,
  NetworkError,
  NotAcceptableError,
  SerializationError,
  TimeoutError,
  UnireqError,
  UnsupportedAuthForTransport,
  UnsupportedMediaTypeError,
  URLNormalizationError,
} from './errors.js';
export type { InspectFormat, InspectOptions } from './inspect.js';
// Introspection and inspection
export { assertHas, inspect } from './inspect.js';
export type { Handler, InspectableMeta, Kind } from './introspection.js';
export {
  attachToGraph,
  getHandlerGraph,
  getInspectableMeta,
  HANDLER_GRAPH,
  INSPECTABLE_META,
  inspectable,
  isInspectable,
  policy,
  redactOptions,
  resetIdCounter,
} from './introspection.js';
export type { LogOptions } from './logging.js';
// Logging
export { log } from './logging.js';
// Result type for functional error handling
export type { Result, ResultPatterns } from './result.js';
export { err, fromPromise, fromTry, isErr, isOk, ok } from './result.js';
export type { RetryDelayStrategy, RetryOptions, RetryPredicate } from './retry.js';
export { retry } from './retry.js';
// Serialization
export { isBodyDescriptor, serializationPolicy } from './serialization.js';
// Slots system
export {
  getSlotMetadata,
  hasSlotType,
  registerSlot,
  slot,
  validatePolicyChain,
} from './slots.js';
export * from './throttle.js';
// Types
export type {
  BodyDescriptor,
  Client,
  ClientOptions,
  Connector,
  EitherBranch,
  Logger,
  MultipartPart,
  Policy,
  Predicate,
  RequestContext,
  RequestOptions,
  Response,
  SafeClient,
  SlotMetadata,
  Transport,
  TransportCapabilities,
  TransportWithCapabilities,
} from './types.js';
export { SlotType } from './types.js';
// URL and header utilities
export {
  appendQueryParams,
  fromNativeHeaders,
  getHeader,
  normalizeHeaders,
  normalizeURL,
  setHeader,
  toNativeHeaders,
} from './url.js';
export type { ValidationAdapter } from './validation.js';
// Validation
export { validate } from './validation.js';
