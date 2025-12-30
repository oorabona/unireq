/**
 * @unireq/http - HTTP(S) transport and policies using Node.js built-in fetch (undici)
 * @see https://undici.nodejs.org
 */

export type { MultipartValidationOptions } from './body.js';
// Body serializers
export { body } from './body.js';
export type { CacheKeyGenerator, CachePolicyOptions, CacheStorage } from './cache.js';
// HTTP Caching
export { cache, MemoryCacheStorage, noCache } from './cache.js';
export type { ETagPolicyOptions, LastModifiedPolicyOptions } from './conditional.js';
// Conditional Requests
export { conditional, etag, lastModified } from './conditional.js';
export type { UndiciConnectorOptions } from './connectors/undici.js';
// Connectors
export { BODY_TIMEOUT_KEY, UndiciConnector } from './connectors/undici.js';
// Request deduplication
export type { DedupeKeyGenerator, DedupeOptions } from './dedupe.js';
export { dedupe } from './dedupe.js';
// Retry predicates (use retry from @unireq/core, only HTTP-specific predicates here)
export type { HttpRetryPredicateOptions } from './http-retry-predicate.js';
export { httpRetryPredicate } from './http-retry-predicate.js';
export type { ErrorInterceptor, RequestInterceptor, ResponseInterceptor } from './interceptors.js';
// Interceptors
export {
  combineRequestInterceptors,
  combineResponseInterceptors,
  interceptError,
  interceptRequest,
  interceptResponse,
} from './interceptors.js';
export type { MultipartField, MultipartFile } from './multipart.js';
// Multipart (deprecated - use body.multipart instead)
export { multipart } from './multipart.js';
// NDJSON streaming
export type { NDJSONEvent, NDJSONParseOptions } from './ndjson.js';
export { parseNDJSON } from './ndjson.js';
// Response parsers
export { parse } from './parse.js';
// Legacy parsers (deprecated - use parse.* instead)
export { accept, json, raw, text } from './parsers.js';
export type { PhaseTimeouts, RedirectPolicyOptions, TimeoutOptions } from './policies.js';
// Policies
export { headers, query, redirectPolicy, timeout } from './policies.js';
// Progress tracking
export type { ProgressCallback, ProgressEvent, ProgressOptions } from './progress.js';
export { progress } from './progress.js';
// Proxy support
export type { ProxyAuth, ProxyConfig } from './proxy.js';
export { proxy } from './proxy.js';
export type { RangeOptions, ResumeState } from './range.js';
// Range requests
export { parseContentRange, range, resume, supportsRange } from './range.js';
// Rate limiting
export type { RateLimitDelayOptions } from './ratelimit.js';
export { parseRetryAfter, rateLimitDelay } from './ratelimit.js';
// Streaming
export type { SSEEvent, SSEParseOptions, StreamBodyOptions, StreamParseOptions } from './stream.js';

// Performance timing
export type { TimedResponse, TimingInfo, TimingOptions } from './timing.js';
export { getTimingMarker, timing } from './timing.js';

// Transport
export { http } from './transport.js';
