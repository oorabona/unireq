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
**Status**: ✅ DONE
**Package**: `@unireq/http`

Improve timeout and cancellation support.

**Implemented**:
- [x] `AbortSignal.timeout()` native support (Node 16.14+)
- [x] `AbortSignal.any()` for signal composition (Node 20+, with fallback)
- [x] Timeout per-phase (request, body, total)
- [x] Graceful timeout with cleanup via reader.cancel()
- [x] Tests: `packages/http/src/__tests__/timeout.test.ts`
- [x] Documentation: `docs/packages/http.md` (EN/FR)

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
| AbortSignal Improvements | ✅ DONE | `@unireq/http` |
| NDJSON Streaming Parser | ✅ DONE | `@unireq/http` |
| Request Deduplication | ✅ DONE | `@unireq/http` |
| Progress Events | ✅ DONE | `@unireq/http` |
| Performance Timing | ✅ DONE | `@unireq/http` |
| Migration Guides | ✅ DONE | `docs/guides/` |
| MSW Testing Patterns | ✅ DONE | `docs/guides/testing.md` |
| Performance Tuning Guide | ✅ DONE | `docs/guides/performance.md` |
| Comparison Documentation | ✅ DONE | `docs/guide/comparison.md` |
| RequestOptions API | ✅ DONE | `@unireq/core` |
| Native baseUrl Support | ✅ DONE | `@unireq/http` |
| Policy Phase Documentation | ✅ DONE | `packages/http/README.md` |
| Result Type & safe.* methods | ✅ DONE | `@unireq/core` |
| httpClient Helper | ✅ DONE | `@unireq/presets` |
| Cheat Sheet & Learning Curve | ✅ DONE | `docs/guide/cheat-sheet.md` |
| Named Presets (restApi, webhook, scraper) | ✅ DONE | `@unireq/presets` |

---

## Remaining Tasks

| Task | Priority | Status |
|------|----------|--------|
| @unireq/cli package | 🔴 High | ✅ DONE |
| Phase 4: API Ergonomics | 🟡 Medium | ✅ DONE |

---

## Phase 6: CLI Improvements (code health audit 2026-03-20)

### 6.1 Backlog (from CLI scopes — merged)

| # | Task | Scope | Priority | Status |
|---|------|-------|----------|--------|
| 6.1.1 | Man pages generation | cli-core | 🟢 | ⏸️ Deferred — requires additional tooling |
| 6.1.2 | DI for keyring module (reduce module-level state) | secrets | 🟢 | - [ ] |

### 6.2 Code Health (audit 2026-03-20)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 6.2.1 | 🔧 Refactor `ProfileConfigModal.tsx` (832 LOC) → split into 3-4 sub-components | 🟡 | - [ ] |
| 6.2.2 | 🔧 Extract JWT signing/verification from `login-jwt.ts` (483 LOC) | 🟢 | - [ ] |
| 6.2.3 | 🧪 Add tests: workspace detection edge cases | 🟡 | - [ ] |
| 6.2.4 | 🧪 Add tests: OpenAPI validator error paths | 🟡 | - [ ] |
| 6.2.5 | 🧪 Add tests: Collections history persistence | 🟡 | - [ ] |
| 6.2.6 | 🧪 Add tests: Secrets vault encryption/decryption | 🟡 | - [ ] |
| 6.2.7 | ✅ Fix `console.log` → `consola.log` (25 violations) | 🔴 | ✅ (2026-03-20) |

### CLI Summary (Phases 1-5 — all complete)

| Phase | Scope | Tasks | Status |
|-------|-------|-------|--------|
| Phase 1: Core Foundation | cli-core, workspace | 12 | ✅ DONE |
| Phase 2: API Integration | openapi, auth | 17 | ✅ DONE |
| Phase 3: Collections & Security | collections, secrets | 14 | ✅ DONE |
| Phase 4: Polish | output, cross-cutting | 7 | ✅ DONE |
| Phase 5: V2 Features | Ink UI, Import/Export | 2 | ✅ DONE |
| **Total** | | **52** | **✅ 52/52** |

---

## Phase 4: API Ergonomics & Developer Experience

**Spec**: [`docs/plans/API-ERGONOMICS-PHASE4-SPEC.md`](docs/plans/API-ERGONOMICS-PHASE4-SPEC.md)
**Status**: ✅ DONE (2025-01-06)

### Task 4.1: Per-Request Policies with Options Object 🟡
**Status**: ✅ DONE
**Package**: `@unireq/core`

Improve API ergonomics for per-request policies and body.

**Implemented**:
- [x] Add `RequestOptions` interface with `body` and `policies` fields
- [x] Support both current variadic API and new options object
- [x] Add `client.request()` method for generic HTTP method
- [x] Tests: `packages/core/src/__tests__/client.test.ts`

### Task 4.2: Native baseUrl Support 🟡
**Status**: ✅ DONE
**Package**: `@unireq/core`, `@unireq/http`

Add native baseUrl support in client factory.

**Implemented**:
- [x] Support `baseUrl` in `http()` transport
- [x] Automatic URL resolution for relative paths
- [x] Consistent behavior with browser fetch
- [x] Documentation: `packages/http/README.md`

### Task 4.3: Policy Phase Documentation 🟢
**Status**: ✅ DONE
**Package**: `@unireq/core`

Document policy ordering and phases.

**Implemented**:
- [x] Document pre-request vs post-response policies in `packages/http/README.md`
- [x] Policy Execution Order section with recommended ordering
- [x] Onion/middleware pattern explanation

### Task 4.4: Result Type for Error Handling 🟢
**Status**: ✅ DONE
**Package**: `@unireq/core`

Optional Result<T, E> wrapper for functional error handling.

**Implemented**:
- [x] Add `Result<T, E>` type: `packages/core/src/result.ts`
- [x] Add `client.safe.*` methods returning Result
- [x] Maintain backward compatibility with throw-based API
- [x] Pattern matching with `result.match({ ok, err })`
- [x] Tests: `packages/core/src/__tests__/result.test.ts`
- [x] Documentation: cheat-sheet, presets README

### Task 4.5: Simple HTTP Client Helper 🟡
**Status**: ✅ DONE
**Package**: `@unireq/presets`

Simple factory function for common use cases.

**Implemented**:
- [x] `httpClient(baseUrl, options)` helper with timeout, headers, query
- [x] Reduce boilerplate for simple use cases
- [x] Keep full composability for advanced users
- [x] `body.auto()` for automatic content-type detection
- [x] Tests: `packages/presets/src/__tests__/http-client.test.ts`
- [x] Documentation: `packages/presets/README.md`, cheat-sheet

### Task 4.6: Named Presets for Common Patterns 🟢
**Status**: ✅ DONE
**Package**: `@unireq/presets`

Predefined configurations for common use cases.

**Implemented**:
- [x] `restApi()` - REST API with retry, rate-limiting, JSON parsing
- [x] `webhook()` - Webhook sender with aggressive retry, no redirects
- [x] `scraper()` - Web scraper with User-Agent, HTML parsing, all redirects
- [x] Tests: `packages/presets/src/__tests__/presets.test.ts` (25 new tests)
- [x] Documentation: `packages/presets/README.md`

---

---

## Phase 5: Code Health (audit astix 2026-02-28)

> Chaque item commence par une **étude d'intention** : comprendre pourquoi le code existe
> (commits, transcripts, docs) avant de décider supprimer / brancher / refactorer.

### 5.1 Dead Exports — Investigation terminée (2026-02-28)

> Investigation complète : git history, code source, docs, call graph intra-fichier.
> Faux positifs identifiés : astix call graph = cross-file uniquement (tests et appels intra-fichier invisibles).

#### 5.1.A — Aucune action (API publique ou test utility — légitimes)

| # | Symbole | Fichier | Verdict | Raison |
|---|---------|---------|---------|--------|
| 5.1.1 | `attachToGraph` | `core/src/introspection.ts:205` | ✅ KEEP | Appelé dans tests. API symétrique read/write du handler graph, prévu pour policies tierces. |
| 5.1.2 | `resetIdCounter` | `core/src/introspection.ts:86` | ✅ KEEP | Utilisé dans `beforeEach` des tests. Utility déterministe intentionnel. |
| 5.1.4 | `fromNativeHeaders` | `core/src/url.ts:197` | ✅ KEEP | API publique pour interop fetch/unireq. Paire symétrique avec `toNativeHeaders`. |
| 5.1.5 | `hasSlotType` | `core/src/slots.ts:123` | ✅ KEEP | Shorthand public pour inspection de policies par consommateurs externes. |
| 5.1.7 | `parseContentRange` | `http/src/range.ts:114` | ✅ KEEP | Documenté dans 3 fichiers docs (EN/FR). Prévu pour usage end-user dans range negotiation. |
| 5.1.8 | `supportsRange` | `http/src/range.ts:98` | ✅ KEEP | Idem. Documenté. Companion de `parseContentRange`. |

#### 5.1.B — Actions requises

| # | Symbole | Fichier | Verdict | Action | Status |
|---|---------|---------|---------|--------|--------|
| 5.1.3 | `createLoggerAdapter` | `core/src/audit.ts:316` | 💡 COMPLETE | Exemple `examples/audit-with-logger.ts` + doc EN/FR dans `docs/packages/core.md`. | ✅ (60c9ac0) |
| 5.1.6 | `getDataSize` | `http/src/body.ts:61` | 🔧 UNEXPORT | Unexporté + extrait dans `internal/size.ts`, partagé entre body.ts et multipart.ts. | ✅ (71cbe2b) |
| 5.1.9 | `raw` | `http/src/parsers.ts:149` | 🗑️ DELETE | Supprimé de parsers.ts, index.ts et tests. BREAKING. | ✅ (71cbe2b) |
| 5.1.10 | `TimingMarker` | `http/src/timing.ts:242` | 🔧 UNEXPORT | `export` retiré puis restauré pour import intra-package (undici.ts). Non ré-exporté par index.ts. | ✅ (71cbe2b, bfe647e) |
| 5.1.11 | `MultipartValidationOptions` | `http/src/body.ts:73` | ✅ KEEP (canonical) | Doublon dans multipart.ts supprimé, remplacé par `import type` depuis body.ts. | ✅ (71cbe2b) |

#### 5.1.C — Bugs découverts pendant l'investigation

| # | Constat | Fichier | Action | Status |
|---|---------|---------|--------|--------|
| 5.1.12 | 🐛 `resume()` envoie `Range` sans vérifier la réponse | `http/src/range.ts` | Fix: `resume()` vérifie maintenant le status de la réponse. Si 200 au lieu de 206, ajoute `x-resume-reset: true` pour signaler que le serveur a renvoyé le fichier complet. 2 tests ajoutés. | ✅ (a8841c6) |

#### 5.1.D — Documentation manquante (API publiques non documentées)

| # | Symbole | Fichier | Action | Status |
|---|---------|---------|--------|--------|
| 5.1.13 | `fromNativeHeaders` | `core/src/url.ts:197` | Déjà documenté dans "Header Conversion Helpers" (EN/FR) avec exemple | ✅ (existant) |
| 5.1.14 | `hasSlotType` | `core/src/slots.ts:123` | Ajouté dans section Introspection docs EN/FR avec exemple | ✅ (920cc31) |
| 5.1.15 | `createLoggerAdapter` | `core/src/audit.ts:316` | Ajouter section dans docs audit + exemple | ✅ (60c9ac0) |

### 5.2 Duplication sémantique

| # | Constat | Fichiers | Action | Status |
|---|---------|----------|--------|--------|
| 5.2.1 | `MultipartValidationOptions` défini 2x (même body_hash `78SiRsU789c`) | `http/src/body.ts:73` (canonical) + `http/src/multipart.ts:25` (doublon) | Supprimer dans `multipart.ts`, `import type` depuis `body.ts` | ✅ (71cbe2b) |
| 5.2.2 | `getDataSize` défini 2x (même body_hash `ZzEb_7rKkD8`) | `http/src/body.ts:61` + `http/src/multipart.ts:83` | Extraire dans `http/src/internal/size.ts`, importer des deux côtés | ✅ (71cbe2b) |
| 5.2.3 | Pattern 304 Not Modified dupliqué dans `etag()` et `lastModified()` | `http/src/conditional.ts` | Extrait `createConditionalPolicy` factory — -36 lignes nettes. `cache.ts` conservé tel quel (architecture async fondamentalement différente). | ✅ (bfe647e) |

### 5.3 Complexité excessive — Refactoring

| # | Fonction | Fichier | Chemins possibles | Action potentielle | Status |
|---|----------|---------|-------------------|-------------------|--------|
| 5.3.1 | `UndiciConnector.request` | `http/src/connectors/undici.ts:69` | **131 072** | Extrait `prepareBody()`, `selectDispatcher()`, `normalizeResponseHeaders()` + `try/finally` pour cleanup agent (3→1 point). | ✅ (a6fdf85) |
| 5.3.2 | `readBodyWithTimeout` | `http/src/connectors/undici.ts:209` | 1 024 | Conservé tel quel — structure `Promise.race` déjà propre, refactoring "state machine" serait over-engineering. | ⏭️ |
| 5.3.3 | `audit` | `core/src/audit.ts:173` | 256 | Extrait `classifySecurityEvent(status)` — remplace if/else chain. | ✅ (fd6aa21) |

### 5.4 Documentation des points de fragilité

| # | Symbole | Fichier | Fichiers affectés | Action | Status |
|---|---------|---------|-------------------|--------|--------|
| 5.4.1 | `policy` | `core/src/introspection.ts:184` | 46 | `@frozen` JSDoc ajouté : "Signature change affects 46 files across 8 packages" | ✅ (fd6aa21) |
| 5.4.2 | `RequestContext` | `core/src/types.ts:8` | 55 | `@frozen` JSDoc ajouté : "Adding required fields is a breaking change across 55 importer files" | ✅ (fd6aa21) |
| 5.4.3 | `client` | `core/src/client.ts:62` | 51 | `@frozen` JSDoc ajouté : "Public API contract — 51 files depend on this signature" | ✅ (fd6aa21) |
| 5.4.4 | `compose` | `core/src/compose.ts:14` | 28 | `@frozen` JSDoc ajouté : "Core composition primitive — 28 files depend transitively" | ✅ (fd6aa21) |

---

## Notes

- All new packages must maintain zero external runtime dependencies
- All features must have 100% test coverage
- Documentation must be bilingual (EN/FR)
- APIs must be fully typed with TypeScript generics
