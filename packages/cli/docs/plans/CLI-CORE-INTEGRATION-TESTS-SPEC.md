---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Integration Tests with msw (Task 1.9)

## 1. User Stories

### US-1: Verify HTTP Request Execution

**AS A** developer maintaining @unireq/cli
**I WANT** integration tests that verify executeRequest() sends correct HTTP requests
**SO THAT** I can ensure requests are properly constructed and sent

**ACCEPTANCE:** Tests verify method, URL, headers, query params, and body

### US-2: Verify Response Handling

**AS A** developer maintaining @unireq/cli
**I WANT** integration tests that verify response display
**SO THAT** I can ensure responses are correctly formatted and shown

**ACCEPTANCE:** Tests verify consola output for status, headers, and body

### US-3: Verify Error Handling

**AS A** developer maintaining @unireq/cli
**I WANT** integration tests that verify error scenarios
**SO THAT** I can ensure errors are handled gracefully

**ACCEPTANCE:** Tests verify timeout, network errors, and HTTP errors

---

## 2. Business Rules

### msw Setup

- Use msw 2.x `setupServer()` for Node.js environment
- Configure handlers in `beforeAll()`, reset in `afterEach()`
- Clean up server in `afterAll()`

### Test Isolation

- Each test should be independent
- Mock consola to capture output
- Reset all mocks between tests

### Coverage Requirements

- All 7 HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Headers and query parameters
- JSON and text body types
- Success (2xx) and error (4xx, 5xx) responses
- Timeout and network error scenarios

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| Dependencies | Add msw to CLI devDependencies |
| Tests | New `src/__tests__/executor.integration.test.ts` |
| Config | May need vitest config for msw |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: GET Request Success

```gherkin
Scenario: Execute GET request successfully
  Given msw server returns 200 with JSON body
  When executeRequest is called with GET method
  Then request is sent to correct URL
  And response status 200 is displayed
  And response body is displayed
```

### S-2: POST Request with JSON Body

```gherkin
Scenario: Execute POST request with JSON body
  Given msw server accepts POST with JSON
  When executeRequest is called with POST method and JSON body
  Then request body is sent correctly
  And Content-Type header is application/json
  And response is displayed
```

### S-3: Request with Headers

```gherkin
Scenario: Execute request with custom headers
  Given msw server echoes headers
  When executeRequest is called with custom headers
  Then headers are sent to server
  And response is displayed
```

### S-4: Request with Query Params

```gherkin
Scenario: Execute request with query parameters
  Given msw server echoes query params
  When executeRequest is called with query params
  Then query params are appended to URL
  And response is displayed
```

### S-5: HTTP Error Response

```gherkin
Scenario: Handle 404 error response
  Given msw server returns 404
  When executeRequest is called
  Then response status 404 is displayed
  And error body is displayed
```

### S-6: Network Error

```gherkin
Scenario: Handle network error
  Given msw simulates network failure
  When executeRequest is called
  Then error message is displayed via consola.error
```

### S-7: All HTTP Methods

```gherkin
Scenario Outline: Execute <method> request
  Given msw server accepts <method> requests
  When executeRequest is called with <method>
  Then request uses <method> HTTP method

Examples:
  | method  |
  | GET     |
  | POST    |
  | PUT     |
  | PATCH   |
  | DELETE  |
  | HEAD    |
  | OPTIONS |
```

---

## 5. Implementation Plan

### Block 1: msw Setup and GET Tests

**Files:**
- `package.json` (MODIFY - add msw to devDependencies)
- `src/__tests__/executor.integration.test.ts` (NEW)

**Deliverables:**
- Add msw to CLI package devDependencies
- Setup msw server with vitest hooks
- Mock consola for output capture
- Implement GET request tests (S-1)

**Acceptance criteria covered:** S-1

### Block 2: POST and Body Tests

**Files:**
- `src/__tests__/executor.integration.test.ts` (MODIFY)

**Deliverables:**
- POST request with JSON body test (S-2)
- Verify Content-Type detection

**Acceptance criteria covered:** S-2

### Block 3: Headers and Query Tests

**Files:**
- `src/__tests__/executor.integration.test.ts` (MODIFY)

**Deliverables:**
- Custom headers test (S-3)
- Query parameters test (S-4)

**Acceptance criteria covered:** S-3, S-4

### Block 4: Error Handling Tests

**Files:**
- `src/__tests__/executor.integration.test.ts` (MODIFY)

**Deliverables:**
- HTTP error (4xx/5xx) tests (S-5)
- Network error test (S-6)

**Acceptance criteria covered:** S-5, S-6

### Block 5: All HTTP Methods

**Files:**
- `src/__tests__/executor.integration.test.ts` (MODIFY)

**Deliverables:**
- Test all 7 HTTP methods (S-7)

**Acceptance criteria covered:** S-7

---

## 6. Test Strategy

### Test Matrix

| Scenario | Integration |
|----------|-------------|
| S-1: GET success | Yes |
| S-2: POST with body | Yes |
| S-3: Custom headers | Yes |
| S-4: Query params | Yes |
| S-5: HTTP errors | Yes |
| S-6: Network error | Yes |
| S-7: All methods | Yes |

### Test Structure (GWT for Integration)

```typescript
describe('executeRequest integration', () => {
  describe('Given msw server is running', () => {
    describe('When GET request is executed', () => {
      it('Then response is displayed correctly', async () => {
        // ...
      });
    });
  });
});
```

---

## Definition of Done

- [ ] msw added to devDependencies
- [ ] Integration test file created
- [ ] All 7 BDD scenarios have passing tests
- [ ] Tests run successfully with vitest
- [ ] Lint/typecheck pass
- [ ] TODO updated
