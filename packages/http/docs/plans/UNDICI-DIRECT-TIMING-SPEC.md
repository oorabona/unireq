---
doc-meta:
  status: canonical
  scope: http
  type: spec
---

# SPEC: Undici Direct Integration + Detailed Timing

## Overview

Refactor `@unireq/http` to use undici directly (instead of Node.js fetch) to enable detailed timing capture including DNS resolution and connection establishment time.

## Goals

1. Replace `fetch()` with `undici.request()` in `UndiciConnector`
2. Capture DNS lookup time via custom lookup function
3. Capture TCP connection time via custom connect function
4. Maintain backward compatibility with existing API

## BDD Scenarios

### Scenario 1: DNS timing is captured

```gherkin
Given a request to a new hostname
When the request completes successfully
Then timing.dns should be a positive number (milliseconds)
And timing.dns should represent DNS resolution time
```

### Scenario 2: Connection timing is captured

```gherkin
Given a request requiring a new TCP connection
When the request completes successfully
Then timing.tcp should be a positive number (milliseconds)
And timing.tcp should represent connection establishment time
```

### Scenario 3: Connection reuse shows zero TCP time

```gherkin
Given two sequential requests to the same host
When both requests complete successfully
Then the second request timing.tcp may be 0 or undefined (pooled)
```

### Scenario 4: All timing fields work together

```gherkin
Given a request with timing policy enabled
When the request completes
Then timing should contain:
  | field    | type   | required |
  | dns      | number | no       |
  | tcp      | number | no       |
  | ttfb     | number | yes      |
  | download | number | yes      |
  | total    | number | yes      |
And total >= dns + tcp + ttfb + download (approximately)
```

### Scenario 5: Existing functionality preserved

```gherkin
Given the existing test suite
When all tests are run
Then all tests should pass
And no breaking changes to public API
```

## Implementation Plan

### Block 1: Add undici dependency + basic refactor

**Files:**
- `packages/http/package.json` - add undici dependency
- `packages/http/src/connectors/undici.ts` - refactor to use `undici.request()`

**Tasks:**
1. Add `undici` to dependencies (latest version)
2. Replace `fetch()` with `undici.request()`
3. Handle response body streaming
4. Ensure existing tests pass

**Test:** Run existing connector tests

### Block 2: DNS timing via custom lookup

**Files:**
- `packages/http/src/connectors/undici.ts` - add custom lookup function
- `packages/http/src/timing.ts` - add `markDns()` method to TimingMarker

**Tasks:**
1. Add `dns?: number` to TimingInfo interface (already exists, just populate)
2. Create wrapper around `dns.lookup()` that measures time
3. Pass custom lookup to undici connect options
4. Update TimingMarker to track DNS time

**Test:** Verify DNS timing appears in response

### Block 3: Connection timing via connect callback

**Files:**
- `packages/http/src/connectors/undici.ts` - add connect timing

**Tasks:**
1. Track time from lookup complete to socket connected
2. Use undici's connect factory option
3. Store connection time in TimingMarker

**Test:** Verify TCP timing appears in response

### Block 4: Integration tests + cleanup

**Files:**
- `packages/http/src/__tests__/timing.test.ts` - add new timing tests
- `packages/http/src/connectors/__tests__/undici.test.ts` - update mocks

**Tasks:**
1. Add tests for DNS timing
2. Add tests for TCP timing
3. Test connection pooling behavior
4. Update existing mocks for undici API

## API Changes

### TimingInfo (existing interface, no changes needed)

```typescript
export interface TimingInfo {
  readonly dns?: number;     // Already optional, will now be populated
  readonly tcp?: number;     // Already optional, will now be populated
  readonly tls?: number;     // Keep optional, NOT populated (future)
  readonly ttfb: number;
  readonly download: number;
  readonly total: number;
  readonly startTime: number;
  readonly endTime: number;
}
```

### UndiciConnector (internal changes only)

No public API changes. Internal implementation switches from `fetch()` to `undici.request()`.

## Dependencies

- `undici`: ^7.x (latest)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| undici API changes | Pin to specific major version |
| Connection pool hides timing | Document that pooled connections show tcp=0 |
| DNS caching hides timing | Document that cached DNS shows dns≈0 |
| Test mocking complexity | Create helper for undici mocking |

## Success Metrics

- [x] All existing tests pass (496 http tests, 2613 cli tests)
- [x] New timing fields populated for fresh connections (dns, tcp via timing policy)
- [ ] CLI displays DNS/TCP timing in inspector (future: CLI integration)
- [x] No performance regression (undici is faster than fetch)
