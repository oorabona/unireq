---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Assertions Engine (Task 5.5)

## 1. User Stories

### US1: Validate Response Status
**AS A** developer testing API endpoints
**I WANT** to assert that responses return expected status codes
**SO THAT** I can detect breaking changes in API contracts

**ACCEPTANCE:** Collection item with `assert: { status: 200 }` passes when response is 200, fails otherwise

### US2: Validate Response Body Content
**AS A** QA engineer running smoke tests
**I WANT** to assert that response bodies contain expected values
**SO THAT** I can verify API responses are correct

**ACCEPTANCE:** Collection item with JSON path assertions validates response body structure and values

### US3: Validate Response Headers
**AS A** developer ensuring security headers
**I WANT** to assert that specific headers are present with expected values
**SO THAT** I can verify security policies are enforced

**ACCEPTANCE:** Collection item with `assert: { headers: { "Content-Type": "application/json" } }` validates headers

---

## 2. Business Rules

### Invariants
- Assertions run AFTER request completes successfully
- All assertions are evaluated (no short-circuit on first failure)
- Assertion results are reported to user via console
- Header name comparison is case-insensitive (HTTP standard)

### Preconditions
- Response must exist (request succeeded)
- AssertConfig must be present on collection item
- For JSON assertions: response body must be valid JSON

### Effects
- Pass: Success message displayed
- Fail: Error message with expected vs actual values
- All results aggregated and reported

### Errors
- `AssertionFailedError`: One or more assertions failed
- `InvalidAssertionError`: Malformed assertion config (e.g., invalid regex)

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | Add `headers` to `ExecuteResult` | Type safety |
| Collections | New `asserter.ts` module | Unit tests |
| Collections | `AssertionResult` type | Type safety |
| Executor | Return headers in `ExecuteResult` | Integration tests |
| Commands | Call asserter after request in `runHandler` | Integration tests |
| Output | Format assertion results | Visual verification |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Status Assertions

#### Scenario 1: Status matches expected
```gherkin
Given response status is 200
And assertion config is { status: 200 }
When assertions are evaluated
Then assertion passes
And success message "Status: 200 ✓" is shown
```

#### Scenario 2: Status does not match
```gherkin
Given response status is 404
And assertion config is { status: 200 }
When assertions are evaluated
Then assertion fails
And error message "Status: expected 200, got 404" is shown
```

### Header Assertions

#### Scenario 3: Header matches expected (case-insensitive)
```gherkin
Given response header "Content-Type" is "application/json"
And assertion config is { headers: { "content-type": "application/json" } }
When assertions are evaluated
Then assertion passes
```

#### Scenario 4: Header value mismatch
```gherkin
Given response header "Content-Type" is "text/html"
And assertion config is { headers: { "Content-Type": "application/json" } }
When assertions are evaluated
Then assertion fails
And error message includes "Content-Type: expected 'application/json', got 'text/html'"
```

#### Scenario 5: Header missing
```gherkin
Given response does not have header "X-Custom-Header"
And assertion config is { headers: { "X-Custom-Header": "value" } }
When assertions are evaluated
Then assertion fails
And error message includes "Header 'X-Custom-Header' not found"
```

### Body Contains Assertion

#### Scenario 6: Body contains string
```gherkin
Given response body is "Hello World"
And assertion config is { contains: "World" }
When assertions are evaluated
Then assertion passes
```

#### Scenario 7: Body does not contain string
```gherkin
Given response body is "Hello World"
And assertion config is { contains: "Goodbye" }
When assertions are evaluated
Then assertion fails
And error message includes "Body does not contain 'Goodbye'"
```

### JSON Path Assertions

#### Scenario 8: JSON path exists
```gherkin
Given response body is {"data":{"id":42}}
And assertion config is { json: [{ path: "$.data.id", op: "exists" }] }
When assertions are evaluated
Then assertion passes
```

#### Scenario 9: JSON path equals value
```gherkin
Given response body is {"count":10}
And assertion config is { json: [{ path: "$.count", op: "equals", value: 10 }] }
When assertions are evaluated
Then assertion passes
```

#### Scenario 10: JSON path equals fails
```gherkin
Given response body is {"count":5}
And assertion config is { json: [{ path: "$.count", op: "equals", value: 10 }] }
When assertions are evaluated
Then assertion fails
And error message includes "$.count: expected 10, got 5"
```

#### Scenario 11: JSON path contains substring
```gherkin
Given response body is {"name":"Alice Smith"}
And assertion config is { json: [{ path: "$.name", op: "contains", value: "Alice" }] }
When assertions are evaluated
Then assertion passes
```

#### Scenario 12: JSON path matches regex
```gherkin
Given response body is {"email":"user@example.com"}
And assertion config is { json: [{ path: "$.email", op: "matches", pattern: "^.+@.+\\..+$" }] }
When assertions are evaluated
Then assertion passes
```

#### Scenario 13: JSON path regex does not match
```gherkin
Given response body is {"email":"invalid-email"}
And assertion config is { json: [{ path: "$.email", op: "matches", pattern: "^.+@.+\\..+$" }] }
When assertions are evaluated
Then assertion fails
And error message includes "$.email: does not match pattern"
```

### Error Scenarios

#### Scenario 14: Non-JSON response with JSON assertion
```gherkin
Given response body is "plain text"
And assertion config is { json: [{ path: "$.id", op: "exists" }] }
When assertions are evaluated
Then assertion fails
And error message includes "Response is not valid JSON"
```

#### Scenario 15: Invalid regex pattern
```gherkin
Given response body is {"email":"test@example.com"}
And assertion config is { json: [{ path: "$.email", op: "matches", pattern: "[invalid" }] }
When assertions are evaluated
Then assertion fails
And error message includes "Invalid regex pattern"
```

### Integration Scenarios

#### Scenario 16: Run command with assertions
```gherkin
Given collection item "smoke/health" has assert config { status: 200 }
And request returns status 200
When "run smoke/health" is executed
Then request executes successfully
And assertions are evaluated
And results are displayed
```

#### Scenario 17: Multiple assertions with mixed results
```gherkin
Given response status 200, body {"error":true}
And assertion config is { status: 200, json: [{ path: "$.error", op: "equals", value: false }] }
When assertions are evaluated
Then status assertion passes
And JSON assertion fails
And both results are reported (not aborted on first failure)
```

---

## 5. Implementation Plan

### Block 1: Asserter Module (Core Engine)

**Package:** `@unireq/cli`

**Files:**
- `src/collections/asserter.ts` - Assertion engine
- `src/collections/__tests__/asserter.test.ts` - Unit tests

**Deliverables:**
- `AssertionResult` type: `{ passed: boolean; message: string; assertion: string }`
- `assertStatus(expected: number, actual: number): AssertionResult`
- `assertHeader(name: string, expected: string, headers: Record<string, string>): AssertionResult`
- `assertContains(expected: string, body: string): AssertionResult`
- `assertJsonPath(assertion: JsonAssertion, body: string): AssertionResult`
- `assertResponse(config: AssertConfig, response: AssertableResponse): AssertionResult[]`

**Acceptance criteria covered:** #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15

**Complexity:** M
**Dependencies:** Reuses `evaluateJsonPath` from `jsonpath.ts`

### Block 2: Executor Enhancement + Integration

**Package:** `@unireq/cli`

**Files:**
- `src/executor.ts` - Add headers to ExecuteResult
- `src/collections/commands.ts` - Integrate asserter in runHandler
- `src/collections/__tests__/commands.test.ts` - Integration tests

**Deliverables:**
- Update `ExecuteResult` to include `headers: Record<string, string>`
- Update `executeRequest` to return headers
- Update `runHandler` to call `assertResponse` when assert config present
- Format and display assertion results

**Acceptance criteria covered:** #16, #17

**Complexity:** S
**Dependencies:** Block 1

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Status matches | Yes | - |
| Status mismatch | Yes | - |
| Header matches (case-insensitive) | Yes | - |
| Header mismatch | Yes | - |
| Header missing | Yes | - |
| Body contains | Yes | - |
| Body not contains | Yes | - |
| JSON exists | Yes | - |
| JSON equals | Yes | - |
| JSON equals fail | Yes | - |
| JSON contains | Yes | - |
| JSON matches | Yes | - |
| JSON matches fail | Yes | - |
| Non-JSON response | Yes | - |
| Invalid regex | Yes | - |
| Run with assertions | - | Yes |
| Multiple mixed results | Yes | Yes |

### Test Data Strategy
- Mock responses with various status codes, headers, bodies
- Fixture JSON bodies for JSON path tests
- Invalid JSON strings for error cases
- Mock `executeRequest` in integration tests

---

## Definition of Done

- [x] ✅ `asserter.ts` module implemented (304 lines)
- [x] ✅ All assertion types: status, headers, contains, json (equals/contains/exists/matches)
- [x] ✅ `ExecuteResult` includes headers
- [x] ✅ `runHandler` calls asserter when assert config present
- [x] ✅ Assertion results displayed to user
- [x] ✅ All 17 BDD scenarios have passing tests (58 unit + 5 integration)
- [x] ✅ Lint/typecheck pass
- [x] ✅ TODO_COLLECTIONS.md updated

**Status:** COMPLETE (2026-01-01)
