---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Request Execution via @unireq/http

**Task:** 1.4
**Priority:** P0
**Scope:** cli-core

## 1. User Stories

### US-1: Execute GET Request

```
AS A CLI user
I WANT to execute GET requests from the command line
SO THAT I can quickly fetch data from APIs without writing code

ACCEPTANCE: Response status, headers, and body are displayed
```

### US-2: Execute POST Request with Body

```
AS A CLI user
I WANT to send POST requests with JSON body
SO THAT I can create resources via APIs

ACCEPTANCE: Body is sent as JSON, response is displayed
```

### US-3: Handle Request Errors Gracefully

```
AS A CLI user
I WANT clear error messages when requests fail
SO THAT I can diagnose issues without stack traces

ACCEPTANCE: Network/timeout errors show user-friendly messages
```

## 2. Business Rules

### BR-1: Header Parsing

- **Format:** Headers must be provided as `key:value` strings
- **Validation:** Must contain exactly one colon separator
- **Effect:** Parsed into `Record<string, string>` for @unireq/http
- **Error:** Invalid format displays "Invalid header format: expected 'key:value', got '<input>'"

### BR-2: Query Parameter Parsing

- **Format:** Query params must be provided as `key=value` strings
- **Validation:** Must contain exactly one equals separator
- **Effect:** Parsed into `Record<string, string>` and appended to URL
- **Error:** Invalid format displays "Invalid query format: expected 'key=value', got '<input>'"

### BR-3: Body Handling

- **JSON Detection:** If body starts with `{` or `[` and is valid JSON, send as `application/json`
- **Fallback:** Non-JSON body is sent as `text/plain`
- **Empty Body:** Allowed for POST/PUT/PATCH (no body sent)

### BR-4: Timeout Behavior

- **Default:** Uses @unireq/config default (no hardcoded value)
- **Override:** `--timeout <ms>` applies timeout policy
- **Error:** Timeout displays "Request timed out after <ms>ms"

### BR-5: Response Display

- **Status Line:** `HTTP/1.1 <status> <statusText>`
- **Headers:** Listed as `key: value` (one per line)
- **Body:** Pretty-printed JSON if `Content-Type` contains `json`, otherwise raw
- **Separator:** Blank line between headers and body

### BR-6: Error Handling

- **Network errors:** Display message without stack trace
- **HTTP 4xx/5xx:** Display response normally (not an exception)
- **Timeout:** Display timeout message with configured duration

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | No changes | ParsedRequest already defined |
| Services | New `executeRequest()` function | Single responsibility |
| Commands | Call `executeRequest()` from request/shortcuts | Integration |
| Output | Response formatting with consola | No PII in logs |

### New Module: `src/executor.ts`

```typescript
// Responsible for:
// - Converting ParsedRequest to @unireq/http request
// - Executing via client()
// - Formatting and displaying response
```

## 4. Acceptance Criteria (BDD Scenarios)

### US-1 Scenarios

```gherkin
Scenario: GET request returns JSON response
  Given a running HTTP server at httpbin.org
  When I execute "unireq get https://httpbin.org/get"
  Then the output shows status "200 OK"
  And the output shows response headers
  And the output shows JSON body with "url" field

Scenario: GET request with custom header
  Given a running HTTP server at httpbin.org
  When I execute "unireq get https://httpbin.org/headers -H 'X-Custom:test-value'"
  Then the response body contains "X-Custom" with value "test-value"

Scenario: GET request with query parameter
  Given a running HTTP server at httpbin.org
  When I execute "unireq get https://httpbin.org/get -q 'foo=bar'"
  Then the response body contains "foo" with value "bar" in args
```

### US-2 Scenarios

```gherkin
Scenario: POST request with JSON body
  Given a running HTTP server at httpbin.org
  When I execute "unireq post https://httpbin.org/post -b '{"name":"test"}'"
  Then the response body contains "json" with the parsed body
  And the request Content-Type was "application/json"

Scenario: POST request with plain text body
  Given a running HTTP server at httpbin.org
  When I execute "unireq post https://httpbin.org/post -b 'hello world'"
  Then the response body contains "data" with "hello world"
  And the request Content-Type was "text/plain"

Scenario: POST request without body
  Given a running HTTP server at httpbin.org
  When I execute "unireq post https://httpbin.org/post"
  Then the response shows status "200 OK"
  And the response body "data" is empty
```

### US-3 Scenarios

```gherkin
Scenario: Request to unreachable host
  Given a non-existent host "http://this-host-does-not-exist.invalid"
  When I execute "unireq get http://this-host-does-not-exist.invalid"
  Then an error message is displayed containing "could not resolve" or "ENOTFOUND"
  And no stack trace is shown

Scenario: Request timeout
  Given a server that delays response for 5 seconds
  When I execute "unireq get <slow-url> --timeout 100"
  Then an error message is displayed containing "timed out"
  And the message includes "100ms"

Scenario: HTTP 404 response
  Given a server returning 404
  When I execute "unireq get https://httpbin.org/status/404"
  Then the output shows status "404 NOT FOUND"
  And no error is thrown (normal response display)

Scenario: HTTP 500 response
  Given a server returning 500
  When I execute "unireq get https://httpbin.org/status/500"
  Then the output shows status "500 INTERNAL SERVER ERROR"
  And no error is thrown (normal response display)
```

### Edge Case Scenarios

```gherkin
Scenario: Invalid header format
  When I execute "unireq get https://example.com -H 'invalid-no-colon'"
  Then an error message is displayed: "Invalid header format"
  And the message includes "expected 'key:value'"

Scenario: Invalid query format
  When I execute "unireq get https://example.com -q 'invalid-no-equals'"
  Then an error message is displayed: "Invalid query format"
  And the message includes "expected 'key=value'"

Scenario: Multiple headers
  Given a running HTTP server at httpbin.org
  When I execute "unireq get https://httpbin.org/headers -H 'X-One:1' -H 'X-Two:2'"
  Then the response contains both headers
```

## 5. Implementation Plan

### Block 1: Executor Core (executeRequest function)

**Package:** @unireq/cli

- **Service:** `src/executor.ts`
  - `parseHeaders(headers: string[]): Record<string, string>` - parse `key:value` format
  - `parseQuery(query: string[]): Record<string, string>` - parse `key=value` format
  - `detectContentType(body: string): string` - detect JSON vs text
  - `executeRequest(request: ParsedRequest): Promise<void>` - main function
- **Tests:** Unit tests for parsing functions
- **Acceptance criteria covered:** Header parsing, query parsing, body detection

**Complexity:** S
**Dependencies:** None

### Block 2: Response Formatting

**Package:** @unireq/cli

- **Service:** `src/executor.ts` (extend)
  - `formatResponse(response: Response): void` - display response with consola
  - Status line formatting
  - Header display
  - JSON pretty-print for JSON responses
- **Tests:** Unit tests for formatting
- **Acceptance criteria covered:** Response display, JSON pretty-print

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Error Handling

**Package:** @unireq/cli

- **Service:** `src/executor.ts` (extend)
  - Catch network errors → user-friendly message
  - Catch timeout errors → timeout message with duration
  - HTTP 4xx/5xx → display normally (not error)
- **Tests:** Unit tests with mocked errors
- **Acceptance criteria covered:** Error scenarios

**Complexity:** S
**Dependencies:** Block 1

### Block 4: Command Integration

**Package:** @unireq/cli

- **Commands:** `src/commands/request.ts`, `src/commands/shortcuts.ts`
  - Replace `printParsedRequest()` with `executeRequest()`
  - Remove placeholder warning
- **Tests:** Integration tests (real HTTP calls to httpbin.org or msw mock)
- **Acceptance criteria covered:** All user stories

**Complexity:** S
**Dependencies:** Blocks 1-3

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Header parsing | Yes | - | - |
| Query parsing | Yes | - | - |
| Body detection | Yes | - | - |
| Response formatting | Yes | - | - |
| GET request | - | Yes (msw) | - |
| POST with body | - | Yes (msw) | - |
| Network error | Yes (mock) | - | - |
| Timeout error | Yes (mock) | - | - |
| HTTP 4xx/5xx | - | Yes (msw) | - |
| Invalid header format | Yes | - | - |
| Invalid query format | Yes | - | - |

### Test Data Strategy

- **Mocking:** Use vitest mocks for @unireq/http client
- **Integration:** Use msw (Mock Service Worker) for HTTP mocking
- **Fixtures:** Predefined ParsedRequest objects for various scenarios

### Mock Requirements

```typescript
// Mock @unireq/http for unit tests
vi.mock('@unireq/http', () => ({
  http: vi.fn(),
  headers: vi.fn(),
  query: vi.fn(),
  timeout: vi.fn(),
  body: { json: vi.fn(), text: vi.fn() },
}));

// Mock @unireq/core for unit tests
vi.mock('@unireq/core', () => ({
  client: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    // ...
  })),
}));
```

---

## Definition of Done

- [ ] Block 1: Executor core implemented with parsing functions
- [ ] Block 2: Response formatting with consola
- [ ] Block 3: Error handling for network/timeout/HTTP errors
- [ ] Block 4: Commands integrated with executeRequest()
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (11 existing + new)
- [ ] Lint/typecheck pass
- [ ] TODO_CLI_CORE.md updated with Task 1.4 ✅
