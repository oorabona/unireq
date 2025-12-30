---
"@unireq/http": minor
---

feat(http): Enhanced timeout policy with true per-phase timeouts

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
  request: 5000,  // 5s for connection + headers
  body: 30000,    // 30s for body download (can be interrupted)
  total: 60000,   // 60s overall limit
})
```

Backward compatible: `timeout(5000)` still works as before.
