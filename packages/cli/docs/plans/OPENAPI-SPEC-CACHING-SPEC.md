---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: OpenAPI Spec Caching (Task 3.8)

## 1. User Stories

### US-1: Fast Session Startup
**AS A** CLI user working with large OpenAPI specifications
**I WANT** previously loaded specs to be cached
**SO THAT** subsequent sessions start faster without re-parsing unchanged specs

**ACCEPTANCE:** Cached spec loads in < 100ms vs 2-5s for full parse

## 2. Business Rules

### BR-1: Cache Location
- Cache stored in `<workspace>/.unireq/cache/` for workspace contexts
- Cache stored in global config path (`~/.config/unireq/cache/` on Linux) for global contexts
- Cache directory created on first write

### BR-2: Cache Key (Files)
- Key = SHA-256 hash of: `source_path + ':' + mtime + ':' + size`
- Enables fast validation without reading file content
- File name = `spec-<hash>.json`

### BR-3: Cache Key (URLs)
- Key = SHA-256 hash of: `url + ':' + etag` (if ETag available)
- Fallback: SHA-256 hash of: `url + ':' + last-modified`
- Fallback: SHA-256 hash of: `url + ':' + fetch_timestamp`

### BR-4: Cache Entry Structure
```typescript
interface CacheEntry {
  /** Version for cache format migrations */
  cacheVersion: 1;
  /** Original source (file path or URL) */
  source: string;
  /** Spec version (2.0, 3.0, 3.1) */
  version: SpecVersion;
  /** Full version string */
  versionFull: string;
  /** Validation metadata */
  validation: {
    /** For files: mtime in ms */
    mtime?: number;
    /** For files: size in bytes */
    size?: number;
    /** For URLs: ETag header */
    etag?: string;
    /** For URLs: Last-Modified header */
    lastModified?: string;
    /** Timestamp when cached */
    cachedAt: number;
  };
  /** The dereferenced OpenAPI document */
  document: OpenAPIDocument;
}
```

### BR-5: Cache Validation
1. For files: Compare current mtime + size with cached values
2. For URLs: Send HEAD request with `If-None-Match` / `If-Modified-Since`
3. If validation fails → re-parse and update cache
4. If validation passes → return cached document

### BR-6: Graceful Degradation
- If cache read fails → parse normally, log warning
- If cache write fails → continue without caching, log warning
- Never throw errors due to cache issues

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| openapi/cache.ts | NEW: Cache manager module | Unit tests |
| openapi/loader.ts | Integrate cache lookup/store | Integration tests |
| openapi/types.ts | Add CacheEntry type | TypeScript |
| workspace/paths.ts | Export cache path helper | Unit tests |

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Cache Miss - File First Load
```gherkin
Given a valid OpenAPI spec file at "api.yaml"
And no cache entry exists for this file
When loadSpec("api.yaml") is called
Then the spec is parsed from file
And a cache entry is created
And the parsed spec is returned
```

### Scenario 2: Cache Hit - Unchanged File
```gherkin
Given a valid OpenAPI spec file at "api.yaml"
And a cache entry exists for this file
And the file has not been modified since caching
When loadSpec("api.yaml") is called
Then the cached spec is returned without parsing
And parse time is < 100ms
```

### Scenario 3: Cache Invalidation - Modified File
```gherkin
Given a valid OpenAPI spec file at "api.yaml"
And a cache entry exists for this file
And the file has been modified since caching
When loadSpec("api.yaml") is called
Then the spec is re-parsed from file
And the cache entry is updated
And the new parsed spec is returned
```

### Scenario 4: Cache Miss - URL First Load
```gherkin
Given a valid OpenAPI spec at "https://api.example.com/openapi.json"
And no cache entry exists for this URL
When loadSpec("https://api.example.com/openapi.json") is called
Then the spec is fetched and parsed
And a cache entry is created with ETag/Last-Modified
And the parsed spec is returned
```

### Scenario 5: Cache Hit - URL Not Modified
```gherkin
Given a valid OpenAPI spec at "https://api.example.com/openapi.json"
And a cache entry exists with ETag "abc123"
And the server returns 304 Not Modified for HEAD request
When loadSpec("https://api.example.com/openapi.json") is called
Then the cached spec is returned
```

### Scenario 6: Graceful Degradation - Corrupt Cache
```gherkin
Given a corrupt cache file exists
When loadSpec("api.yaml") is called
Then the spec is parsed from source (ignoring cache)
And the corrupt cache is replaced with valid entry
And no error is thrown
```

### Scenario 7: Graceful Degradation - Read-Only Directory
```gherkin
Given the cache directory is not writable
When loadSpec("api.yaml") is called
Then the spec is parsed normally
And a warning is logged
And no error is thrown
```

## 5. Implementation Plan

### Block 1: Cache Types and Storage
**Packages:** cli

- **Types:** Add `CacheEntry` interface to `openapi/types.ts`
- **Storage:** Create `openapi/cache/storage.ts`:
  - `getCachePath(source: string, workspace?: string): string`
  - `readCache(path: string): CacheEntry | null`
  - `writeCache(path: string, entry: CacheEntry): boolean`
- **Tests:** Unit tests for storage functions

**Complexity:** S
**Acceptance criteria covered:** None directly (infrastructure)

### Block 2: File Cache Manager
**Packages:** cli

- **Manager:** Create `openapi/cache/file-cache.ts`:
  - `getFileCacheKey(source: string): Promise<string | null>` - get mtime+size hash
  - `validateFileCache(source: string, entry: CacheEntry): Promise<boolean>`
  - `cacheFileSpec(source: string, spec: LoadedSpec): Promise<void>`
  - `getCachedFileSpec(source: string): Promise<LoadedSpec | null>`
- **Tests:** Unit tests for file caching

**Complexity:** M
**Acceptance criteria covered:** #1, #2, #3

### Block 3: URL Cache Manager
**Packages:** cli

- **Manager:** Create `openapi/cache/url-cache.ts`:
  - `getUrlCacheKey(source: string, etag?: string, lastModified?: string): string`
  - `validateUrlCache(source: string, entry: CacheEntry): Promise<boolean>`
  - `cacheUrlSpec(source: string, spec: LoadedSpec, headers: Headers): Promise<void>`
  - `getCachedUrlSpec(source: string): Promise<LoadedSpec | null>`
- **Tests:** Unit tests for URL caching with mocked fetch

**Complexity:** M
**Acceptance criteria covered:** #4, #5

### Block 4: Loader Integration
**Packages:** cli

- **Loader:** Modify `openapi/loader.ts`:
  - Add cache lookup before parsing
  - Add cache storage after parsing
  - Handle graceful degradation
- **Tests:** Integration tests for end-to-end caching

**Complexity:** S
**Acceptance criteria covered:** #6, #7

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Cache storage read/write | Yes | - |
| File cache key generation | Yes | - |
| File cache validation | Yes | - |
| URL cache key generation | Yes | - |
| URL cache validation | Yes | - |
| Full cache miss → hit flow | - | Yes |
| Cache invalidation | - | Yes |
| Graceful degradation | Yes | Yes |

### Test Data Strategy
- Create temp directories for cache tests
- Use fixture OpenAPI specs from existing tests
- Mock fetch for URL cache tests
- Mock fs for error scenarios

---

## Definition of Done

- [x] All blocks implemented ✅ 2026-01-01
- [x] All BDD scenarios have passing tests ✅ 2026-01-01
- [x] All tests pass (1314 tests) ✅ 2026-01-01
- [x] Lint/typecheck pass ✅ 2026-01-01
- [x] Documentation updated (TODO_OPENAPI.md) ✅ 2026-01-01
