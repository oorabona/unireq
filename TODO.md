# @unireq - Roadmap & Improvements

## Overview

This document tracks planned improvements and features for @unireq based on competitive analysis against the npm ecosystem (axios, got, ky, undici, ofetch, wretch).

---

## Priority Legend

- 🔴 **High** - Critical for enterprise adoption
- 🟡 **Medium** - Important for feature parity
- 🟢 **Nice-to-have** - Polish and DX improvements

---

## Phase 1: Enterprise Observability & Networking

### Task 1.1: OpenTelemetry Integration 🔴
**Status**: ✅ DONE
**Package**: `@unireq/otel`

Create a dedicated package for OpenTelemetry instrumentation.

**Implemented**:
- [x] Automatic span creation for HTTP requests
- [x] Propagate trace context (W3C Trace Context)
- [x] Record request/response attributes
- [x] Support custom span naming
- [x] Error recording with span status
- [x] Tests: `packages/otel/src/__tests__/tracing.test.ts`
- [x] Example: `examples/otel-tracing.ts`

---

### Task 1.2: Proxy Support 🔴
**Status**: ✅ DONE
**Package**: `@unireq/http`

Add HTTP/HTTPS/SOCKS proxy support.

**Implemented**:
- [x] HTTP proxy configuration
- [x] HTTPS proxy support
- [x] Proxy authentication (Basic)
- [x] NO_PROXY environment variable support
- [x] Environment-based proxy detection (`proxy.fromEnv()`)
- [x] Per-request proxy bypass logic
- [x] Tests: `packages/http/src/__tests__/proxy.test.ts`
- [x] Example: `examples/proxy-usage.ts`

---

### Task 1.3: AbortSignal Improvements 🔴
**Status**: ⬜ TODO
**Package**: `@unireq/http`

Improve timeout and cancellation support.

**Requirements**:
- [ ] `AbortSignal.timeout()` native support
- [ ] `AbortSignal.any()` for signal composition
- [ ] Timeout per-phase (connect, headers, body)
- [ ] Graceful timeout with cleanup

---

## Phase 2: Streaming & Performance

### Task 2.1: NDJSON Streaming Parser 🟡
**Status**: ✅ DONE
**Package**: `@unireq/http`

Add support for newline-delimited JSON (NDJSON) streaming.

**Implemented**:
- [x] Async iterator for NDJSON streams
- [x] Backpressure handling via ReadableStream
- [x] Error recovery for malformed lines with `onError` callback
- [x] TypeScript generics for event types
- [x] Skip empty lines option
- [x] Custom transform function
- [x] Tests: `packages/http/src/__tests__/ndjson.test.ts`
- [x] Example: `examples/ndjson-streaming.ts`

---

### Task 2.2: Request Deduplication 🟡
**Status**: ✅ DONE
**Package**: `@unireq/http`

Deduplicate identical in-flight requests.

**Implemented**:
- [x] Key-based deduplication with configurable key generator
- [x] TTL for deduplication window (default: 100ms)
- [x] Support for configurable HTTP methods (default: GET, HEAD)
- [x] Max size limit for pending requests map
- [x] Tests: `packages/http/src/__tests__/dedupe.test.ts`
- [x] Example: `examples/request-dedupe.ts`

---

### Task 2.3: Progress Events 🟡
**Status**: ✅ DONE
**Package**: `@unireq/http`

Add upload/download progress tracking.

**Implemented**:
- [x] `onUploadProgress` callback
- [x] `onDownloadProgress` callback
- [x] Progress percentage calculation
- [x] Bytes loaded/total tracking
- [x] Rate calculation (bytes/sec)
- [x] Estimated time remaining (ETA)
- [x] Throttled callbacks to avoid excessive updates
- [x] Tests: `packages/http/src/__tests__/progress.test.ts`
- [x] Example: `examples/progress-tracking.ts`

---

### Task 2.4: Performance Timing 🟡
**Status**: ✅ DONE
**Package**: `@unireq/http`

Expose detailed timing information.

**Implemented**:
- [x] Time to first byte (TTFB)
- [x] Content download time
- [x] Total request time
- [x] Start/end timestamps
- [x] Callback for timing events
- [x] Tests: `packages/http/src/__tests__/timing.test.ts`
- [x] Example: `examples/timing-metrics.ts`

---

## Phase 3: Documentation & DX

### Task 3.1: Migration Guides 🟢
**Status**: ✅ DONE
**Location**: `docs/guides/`

Create migration guides from popular libraries.

**Implemented**:
- [x] Migration from axios: `docs/guides/migrate-axios.md`
- [x] Migration from got: `docs/guides/migrate-got.md`
- [x] Migration from ky: `docs/guides/migrate-ky.md`
- [x] Common patterns comparison
- [x] Side-by-side code examples

---

### Task 3.2: Testing Patterns with MSW 🟢
**Status**: ✅ DONE
**Location**: `docs/guides/testing.md`

Document testing strategies with Mock Service Worker.

**Implemented**:
- [x] Basic MSW setup with Vitest
- [x] Testing retry logic
- [x] Testing circuit breaker states
- [x] Testing error handling
- [x] Testing OAuth flows
- [x] Testing streaming/SSE
- [x] Best practices section

---

### Task 3.3: Performance Tuning Guide 🟢
**Status**: ✅ DONE
**Location**: `docs/guides/performance.md`

Document performance optimization strategies.

**Implemented**:
- [x] Connection pooling with UndiciConnector
- [x] HTTP/2 multiplexing
- [x] Request deduplication
- [x] Response caching strategies
- [x] Conditional requests (ETag/Last-Modified)
- [x] Rate limiting and throttling
- [x] Timeout configuration
- [x] Streaming for large files
- [x] Compression settings
- [x] Monitoring and timing
- [x] Benchmarking examples
- [x] Optimization checklist

---

### Task 3.4: Comparison Documentation 🟢
**Status**: ✅ DONE
**Location**: `docs/guide/comparison.md`

Document @unireq advantages vs alternatives.

**Implemented**:
- [x] Feature matrix vs axios, got, ky, undici, ofetch, wretch
- [x] Unique strengths section
- [x] Use case recommendations
- [x] English version: `docs/guide/comparison.md`
- [x] French version: `docs/fr/guide/comparison.md`

---

## Completed Tasks Summary

| Task | Status | Package/Location |
|------|--------|------------------|
| OpenTelemetry Integration | ✅ DONE | `@unireq/otel` |
| Proxy Support | ✅ DONE | `@unireq/http` |
| NDJSON Streaming Parser | ✅ DONE | `@unireq/http` |
| Request Deduplication | ✅ DONE | `@unireq/http` |
| Progress Events | ✅ DONE | `@unireq/http` |
| Performance Timing | ✅ DONE | `@unireq/http` |
| Migration Guides | ✅ DONE | `docs/guides/` |
| MSW Testing Patterns | ✅ DONE | `docs/guides/testing.md` |
| Performance Tuning Guide | ✅ DONE | `docs/guides/performance.md` |
| Comparison Documentation | ✅ DONE | `docs/guide/comparison.md` |

---

## Remaining Tasks

| Task | Priority | Status |
|------|----------|--------|
| AbortSignal Improvements | 🔴 High | ⬜ TODO |

---

## Notes

- All new packages must maintain zero external runtime dependencies
- All features must have 100% test coverage
- Documentation must be bilingual (EN/FR)
- APIs must be fully typed with TypeScript generics
