# @unireq/http

## 2.0.0

### Major Changes

- Remove deprecated `raw` parser export (BREAKING).

  Add `x-resume-reset` header detection in `resume()` policy when server returns 200 instead of 206 Partial Content.

  Extract `createConditionalPolicy` factory to deduplicate `etag()` and `lastModified()` implementations.

  Decompose `UndiciConnector.request` into focused helpers (`prepareBody`, `selectDispatcher`, `normalizeResponseHeaders`) with simplified resource cleanup via `try/finally`.

  Clean dead exports and deduplicate internal code (`getDataSize`, `MultipartValidationOptions`).

### Patch Changes

- Updated dependencies
  - @unireq/core@1.0.2

## 1.1.0

### Minor Changes

- 826a695: feat(http): Enhanced timeout policy with true per-phase timeouts

  **Per-phase timeout configuration:**

  - `request`: Connection + TTFB (until headers received) - uses AbortSignal
  - `body`: Response body download - uses streaming with reader.cancel()
  - `total`: Overall safety limit - uses AbortSignal

  **Technical improvements:**

  - Native `AbortSignal.timeout()` for efficient timer management (Node 16.14+)
  - `AbortSignal.any()` for composing signals (Node 20+, with manual fallback)
  - True body interruption via `ReadableStream.getReader().cancel()`
  - Proper cleanup prevents memory leaks

  **Usage:**

  ```typescript
  timeout({
    request: 5000, // 5s for connection + headers
    body: 30000, // 30s for body download (can be interrupted)
    total: 60000, // 60s overall limit
  });
  ```

  Backward compatible: `timeout(5000)` still works as before.

## 1.0.1

### Patch Changes

- adff465: Add README.md documentation for npm package pages
- Updated dependencies [adff465]
  - @unireq/config@1.0.1
  - @unireq/core@1.0.1

## 1.0.0

### Major Changes

- 5bb409b: Initial public release

### Patch Changes

- Updated dependencies [5bb409b]
  - @unireq/config@1.0.0
  - @unireq/core@1.0.0
