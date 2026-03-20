---
doc-meta:
  status: canonical
  scope: core
  type: specification
  created: 2025-01-06
  updated: 2025-01-06
---

# Specification: API Ergonomics Phase 4

## 1. User Stories

### Story 1: Per-Request Policies with Options Object
```
AS A developer using @unireq/core
I WANT to pass per-request options (body, policies, signal) via an options object
SO THAT I can compose requests more ergonomically without losing backward compatibility

ACCEPTANCE: Both variadic and options-object APIs work interchangeably
```

### Story 2: Functional Error Handling with Result Type
```
AS A developer who prefers functional patterns
I WANT a Result<T, E> type with map/flatMap/unwrap methods
SO THAT I can handle errors without try/catch blocks

ACCEPTANCE: client.safe.* methods return Result<Response<T>, Error>
```

### Story 3: Simple HTTP Client Factory
```
AS A developer who wants axios-like simplicity
I WANT a single httpClient({ baseUrl, timeout, headers, retry }) helper
SO THAT I can create configured clients without learning the policy system

ACCEPTANCE: One-liner client creation with common options
```

---

## 2. Business Rules

### BR-1: API Backward Compatibility
- **Invariant**: Existing variadic API MUST continue to work unchanged
- **Effect**: New options object API is additive via TypeScript overloads
- **Error**: Compilation error if breaking change detected

### BR-2: Result Type Behavior
- **Invariant**: Result is either Ok<T> or Err<E>, never both
- **Precondition**: `client.safe.*` methods never throw (except programmer errors)
- **Effect**: Network/HTTP errors wrapped in Err, success in Ok
- **Error**: `result.unwrap()` throws if called on Err

### BR-3: Policy Phase Ordering
- **Invariant**: Policies execute in documented phase order
- **Phases** (from builder.ts):
  1. Request preparation (headers, query, accept)
  2. Flow control (timeout, throttle, circuit breaker, redirect, retry)
  3. Caching (conditional, cache)
  4. Authentication (oauth, bearer)
  5. Interceptors (request, response, error)
  6. Observability (logging, tracing)
  7. Response processing (validation, parse)
- **Effect**: User-provided policies compose within appropriate phase

### BR-4: httpClient() Helper Defaults
- **Invariant**: Helper provides sensible defaults, not magic behavior
- **Defaults**:
  - timeout: 30000ms (30s)
  - retry: 3 attempts with exponential backoff
  - json: true (Accept + Content-Type)
- **Effect**: Returns standard Client instance

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| @unireq/core/types.ts | Add RequestOptions, Result, ClientWithSafe | Type tests |
| @unireq/core/client.ts | Add overloads for options object | Unit tests |
| @unireq/core/result.ts | New Result<T,E> implementation | Unit tests |
| @unireq/core/index.ts | Export new types and functions | Integration tests |
| @unireq/presets/simple.ts | New httpClient() helper | Integration tests |
| @unireq/presets/index.ts | Export httpClient | Integration tests |
| docs/guide/policy-phases.md | New documentation | Manual review |

---

## 4. Acceptance Criteria (BDD Scenarios)

### AC-1: Per-Request Options Object

```gherkin
Scenario: POST with options object containing body and policies
  Given a client created with http transport
  When calling client.post('/users', { body: { name: 'Alice' }, policies: [timeout(5000)] })
  Then the request is sent with JSON body
  And the timeout policy is applied

Scenario: GET with backward-compatible variadic API
  Given a client created with http transport
  When calling client.get('/users', timeout(5000), retry(3))
  Then all policies are composed and applied
  And the response is returned

Scenario: Mixed API usage in same codebase
  Given TypeScript compilation
  When both variadic and options-object calls exist
  Then compilation succeeds without errors
  And runtime behavior is identical
```

### AC-2: Result Type Implementation

```gherkin
Scenario: Successful request returns Ok
  Given client.safe.get('/users') is called
  When the server responds with 200 OK
  Then result.isOk() returns true
  And result.unwrap() returns the Response<T>

Scenario: Network error returns Err
  Given client.safe.get('/unreachable') is called
  When the network is unavailable
  Then result.isErr() returns true
  And result.unwrap() throws the Error
  And result.unwrapOr(fallback) returns fallback

Scenario: Result.map transforms success value
  Given a successful Result<Response<User>>
  When calling result.map(r => r.data.name)
  Then a new Result<string> is returned with the name

Scenario: Result.flatMap chains operations
  Given a successful Result<Response<User>>
  When calling result.flatMap(r => fetchProfile(r.data.id))
  Then the profile fetch is executed
  And a flattened Result<Response<Profile>> is returned

Scenario: Err.map is a no-op
  Given a failed Result (Err)
  When calling result.map(fn)
  Then the same Err is returned
  And fn is never called
```

### AC-3: httpClient() Helper

```gherkin
Scenario: Create simple JSON API client
  Given httpClient({ baseUrl: 'https://api.example.com' })
  When the client is built
  Then it has JSON parsing enabled by default
  And baseUrl is used for relative paths

Scenario: Override defaults
  Given httpClient({ baseUrl, timeout: 60000, retry: { tries: 5 } })
  When the client is built
  Then timeout is 60000ms instead of default 30000ms
  And retry attempts is 5 instead of default 3

Scenario: Add custom headers
  Given httpClient({ baseUrl, headers: { 'X-API-Key': 'secret' } })
  When any request is made
  Then the X-API-Key header is included

Scenario: Disable retry
  Given httpClient({ baseUrl, retry: false })
  When a request fails
  Then no retry is attempted
```

### AC-4: Policy Phase Documentation

```gherkin
Scenario: Documentation describes all phases
  Given docs/guide/policy-phases.md exists
  When reading the documentation
  Then all 7 phases are described with examples
  And ordering rules are clearly stated

Scenario: Custom policy placement guidance
  Given a user wants to add a custom logging policy
  When reading the documentation
  Then they know to place it in Observability phase
  And they understand execution order relative to other policies
```

### AC-5: BaseUrl Support

```gherkin
Scenario: Relative path resolution
  Given http('https://api.example.com') transport
  When client.get('/users') is called
  Then the final URL is https://api.example.com/users

Scenario: Absolute URL bypasses baseUrl
  Given http('https://api.example.com') transport
  When client.get('https://other.com/data') is called
  Then the final URL is https://other.com/data

Scenario: Path with leading slash
  Given http('https://api.example.com/v1') transport
  When client.get('/users') is called
  Then the final URL is https://api.example.com/v1/users
```

---

## 5. Implementation Plan

### Block 1: Result<T, E> Type (Vertical Slice)
**Package**: `@unireq/core`
**Complexity**: M

**Files**:
- `packages/core/src/result.ts` (new)
- `packages/core/src/__tests__/result.test.ts` (new)
- `packages/core/src/index.ts` (export)

**Implementation**:
```typescript
// Result type with Ok and Err variants
export type Result<T, E> = Ok<T, E> | Err<T, E>;

interface Ok<T, E> {
  readonly _tag: 'Ok';
  readonly value: T;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  map<U>(fn: (value: T) => U): Result<U, E>;
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  unwrap(): T;
  unwrapOr(fallback: T): T;
  unwrapErr(): never;
  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U;
}

interface Err<T, E> {
  readonly _tag: 'Err';
  readonly error: E;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  map<U>(fn: (value: T) => U): Result<U, E>;
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  unwrap(): never;
  unwrapOr(fallback: T): T;
  unwrapErr(): E;
  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U;
}

// Factory functions
export function ok<T, E = never>(value: T): Ok<T, E>;
export function err<T = never, E = unknown>(error: E): Err<T, E>;
```

**Acceptance Criteria Covered**: AC-2 (all scenarios)

---

### Block 2: Per-Request Options Object (Vertical Slice)
**Package**: `@unireq/core`
**Complexity**: M

**Files**:
- `packages/core/src/types.ts` (add RequestOptions, update Client)
- `packages/core/src/client.ts` (add overloads)
- `packages/core/src/__tests__/client.test.ts` (add tests)

**Implementation**:
```typescript
// New type
export interface RequestOptions {
  readonly body?: unknown;
  readonly policies?: ReadonlyArray<Policy>;
  readonly signal?: AbortSignal;
}

// Updated Client interface with overloads
export interface Client {
  // Existing variadic API
  readonly get: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Response<T>>;
  // New options API
  readonly get: <T = unknown>(url: string, options: RequestOptions) => Promise<Response<T>>;
  // ... same for post, put, patch, delete, etc.
}
```

**Acceptance Criteria Covered**: AC-1 (all scenarios)

---

### Block 3: ClientWithSafe + client.safe.* Methods (Vertical Slice)
**Package**: `@unireq/core`
**Complexity**: M

**Files**:
- `packages/core/src/types.ts` (add SafeClient, ClientWithSafe)
- `packages/core/src/client.ts` (add safe wrapper)
- `packages/core/src/__tests__/client-safe.test.ts` (new)

**Implementation**:
```typescript
// Safe client that returns Result
export interface SafeClient {
  readonly get: <T = unknown>(url: string, ...policies: ReadonlyArray<Policy>) => Promise<Result<Response<T>, Error>>;
  readonly get: <T = unknown>(url: string, options: RequestOptions) => Promise<Result<Response<T>, Error>>;
  // ... same pattern for all methods
}

// Extended client with safe property
export interface ClientWithSafe extends Client {
  readonly safe: SafeClient;
}

// Updated client() function returns ClientWithSafe
export function client(transport: Transport | TransportWithCapabilities, ...policies: ReadonlyArray<Policy>): ClientWithSafe;
```

**Acceptance Criteria Covered**: AC-2 (integration with client)

---

### Block 4: httpClient() Helper (Vertical Slice)
**Package**: `@unireq/presets`
**Complexity**: S

**Files**:
- `packages/presets/src/simple.ts` (new)
- `packages/presets/src/__tests__/simple.test.ts` (new)
- `packages/presets/src/index.ts` (export)

**Implementation**:
```typescript
export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly timeout?: number;           // default: 30000
  readonly retry?: RetryConfig | false; // default: { tries: 3 }
  readonly headers?: Record<string, string>;
  readonly json?: boolean;             // default: true
}

export function httpClient(options: HttpClientOptions): ClientWithSafe {
  // Build using PresetBuilder internally
  let builder = preset.uri(options.baseUrl);

  if (options.json !== false) builder = builder.json;
  if (options.timeout) builder = builder.withTimeout(options.timeout);
  else builder = builder.timeout; // default 30s

  if (options.retry !== false) {
    builder = typeof options.retry === 'object'
      ? builder.withRetry(options.retry)
      : builder.retry; // default 3 tries
  }

  if (options.headers) builder = builder.withHeaders(options.headers);

  return builder.build();
}
```

**Acceptance Criteria Covered**: AC-3 (all scenarios)

---

### Block 5: BaseUrl Documentation + Tests (Vertical Slice)
**Package**: `@unireq/http`
**Complexity**: S

**Files**:
- `packages/http/src/__tests__/transport.test.ts` (add baseUrl tests)
- `docs/guide/policy-phases.md` (new)

**Note**: BaseUrl resolution already exists in `http(uri)` transport (line 34 of transport.ts).
This block focuses on documentation and explicit test coverage.

**Acceptance Criteria Covered**: AC-4, AC-5

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Result type methods | Yes | - | - |
| Result.map/flatMap | Yes | - | - |
| Result.unwrap throws | Yes | - | - |
| Options object API | Yes | Yes | - |
| Variadic API (regression) | Yes | Yes | - |
| client.safe.* returns Result | Yes | Yes | - |
| httpClient() helper | Yes | Yes | - |
| baseUrl resolution | Yes | Yes | - |

### Test Data Strategy
- Use MSW for HTTP mocking
- Create fixtures for User, Profile types
- Test both success (2xx) and error (4xx, 5xx, network) scenarios

### Coverage Requirements
- Result type: 100% branch coverage
- Client overloads: All method signatures tested
- httpClient: All option combinations tested

---

## Definition of Done

- [ ] Block 1: Result<T, E> implemented with all methods
- [ ] Block 2: Per-request options object with overloads
- [ ] Block 3: client.safe.* methods returning Result
- [ ] Block 4: httpClient() helper in @unireq/presets
- [ ] Block 5: BaseUrl documentation + test coverage
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (0 failures)
- [ ] Lint/typecheck pass
- [ ] Documentation: policy-phases.md created
- [ ] Exports added to package index files
