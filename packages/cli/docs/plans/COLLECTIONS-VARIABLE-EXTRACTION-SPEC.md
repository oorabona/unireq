---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Variable Extraction - JSONPath-lite (Task 5.4)

## 1. User Stories

### US1: Extract Token from Login Response
**AS A** developer testing an authenticated API
**I WANT** to extract the JWT token from a login response
**SO THAT** I can use it in subsequent authenticated requests

**ACCEPTANCE:** After running login request with `extract: { vars: { token: "$.token" } }`, the value is available as `${var:token}`

### US2: Chain API Requests
**AS A** developer testing a CRUD workflow
**I WANT** to extract a created resource ID from POST response
**SO THAT** I can use it in GET/PUT/DELETE requests

**ACCEPTANCE:** Extract `$.data.id` from POST, use in `GET /resources/${var:id}`

### US3: Manual Extraction from Last Response
**AS A** developer exploring an API interactively
**I WANT** to extract values from the last response manually
**SO THAT** I can save useful values for later use

**ACCEPTANCE:** `extract token $.token` command saves value to `${var:token}`

---

## 2. Business Rules

### Invariants
- JSONPath expressions must start with `$`
- Extracted values are stored as strings (numbers/booleans converted)
- Variables persist in REPL session until overwritten or session ends

### Preconditions
- Response must be valid JSON for extraction
- Path must be valid JSONPath-lite syntax

### Effects
- Successful extraction stores variable in REPL state
- Variables are available via `${var:name}` interpolation
- Existing variable with same name is overwritten

### Errors
- `InvalidJsonPathError`: Path syntax is invalid
- `JsonPathNotFoundError`: Required path not found in response
- `ExtractionError`: Response is not JSON or empty

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Collections | `jsonpath.ts` - JSONPath-lite parser | Unit tests |
| Collections | `extractor.ts` - Variable extraction engine | Unit tests |
| REPL State | Add `extractedVars: Record<string, string>` | Type safety |
| Collections | Update runHandler to extract after execution | Integration tests |
| REPL Commands | Add `extract` command for manual extraction | Integration tests |
| Workspace Variables | Integrate extractedVars into interpolation context | Integration tests |

---

## 4. JSONPath-lite Syntax

### Supported Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| Root | `$` | Root object |
| Property | `$.name` | Property access |
| Nested | `$.data.id` | Nested property |
| Array index | `$.items[0]` | Array element by index |
| Nested array | `$.items[0].name` | Property of array element |
| Optional | `$.token?` | Optional (no error if missing) |

### NOT Supported (Out of Scope)

| Pattern | Description |
|---------|-------------|
| `$..name` | Recursive descent |
| `$.items[*]` | Wildcard |
| `$.items[?(@.id>5)]` | Filter expressions |
| `$.items[-1]` | Negative index |
| `$.items[0:3]` | Slicing |

---

## 5. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Extract simple property
```gherkin
Given response body {"token":"abc123"}
When extraction is run with path "$.token"
Then variable "token" has value "abc123"
```

### Scenario 2: Extract nested property
```gherkin
Given response body {"data":{"user":{"id":42}}}
When extraction is run with path "$.data.user.id"
Then variable has value "42" (as string)
```

### Scenario 3: Extract from array
```gherkin
Given response body {"items":[{"id":1},{"id":2}]}
When extraction is run with path "$.items[0].id"
Then variable has value "1"
```

### Scenario 4: Path not found (required)
```gherkin
Given response body {"data":{}}
When extraction is run with path "$.token"
Then JsonPathNotFoundError is thrown
And error message includes "$.token"
And error message includes available keys
```

### Scenario 5: Optional path not found
```gherkin
Given response body {"data":{}}
When extraction is run with path "$.token?"
Then no error is thrown
And variable is set to undefined/null
```

### Scenario 6: Invalid JSONPath syntax
```gherkin
Given path "$invalid" (missing dot)
When path is parsed
Then InvalidJsonPathError is thrown
And error message explains valid syntax
```

### Scenario 7: Non-JSON response
```gherkin
Given response body "plain text"
When extraction is attempted
Then ExtractionError is thrown
And message is "Response is not valid JSON"
```

### Scenario 8: Run with extract config
```gherkin
Given collection item with extract config:
  extract:
    vars:
      token: "$.access_token"
      userId: "$.user.id"
And request returns {"access_token":"jwt...","user":{"id":42}}
When run command executes the item
Then ${var:token} resolves to "jwt..."
And ${var:userId} resolves to "42"
```

### Scenario 9: Manual extract command
```gherkin
Given last response was {"data":{"id":"abc"}}
When user types "extract myId $.data.id"
Then message "Extracted: myId = abc" is shown
And ${var:myId} resolves to "abc"
```

### Scenario 10: Extracted vars available in next request
```gherkin
Given extracted variable token = "abc123"
When request body contains "${var:token}"
Then body is sent with "abc123"
```

---

## 6. Implementation Plan

### Block 1: JSONPath Parser (Vertical Slice)

**Files:**
- `src/collections/jsonpath.ts` - Parser and evaluator
- `src/collections/__tests__/jsonpath.test.ts` - Unit tests

**Deliverables:**
- `parseJsonPath(path: string): JsonPathSegment[]`
- `evaluateJsonPath(segments: JsonPathSegment[], data: unknown): unknown`
- Error classes: `InvalidJsonPathError`, `JsonPathNotFoundError`
- Support: `$.prop`, `$.a.b.c`, `$.arr[0]`, `$.arr[0].prop`, `$.prop?`

**Acceptance criteria covered:** #1, #2, #3, #4, #5, #6

### Block 2: Extractor Engine + State (Vertical Slice)

**Files:**
- `src/collections/extractor.ts` - Extraction engine
- `src/collections/__tests__/extractor.test.ts` - Unit tests
- `src/repl/state.ts` - Add extractedVars field

**Deliverables:**
- `extractVariables(body: string, config: ExtractConfig): Record<string, string>`
- `ExtractionError` class
- Add `extractedVars?: Record<string, string>` to ReplState
- Integration with interpolation context

**Acceptance criteria covered:** #7, #10

### Block 3: Run Integration + Extract Command (Vertical Slice)

**Files:**
- `src/collections/commands.ts` - Update runHandler, add extractHandler
- `src/collections/__tests__/extract-command.test.ts` - Integration tests
- `src/repl/commands.ts` - Register extract command

**Deliverables:**
- Update `runHandler` to call extractor after execution
- Create `extractHandler` for manual extraction
- Create `createExtractCommand()`
- Store last response body in state for manual extraction

**Acceptance criteria covered:** #8, #9

---

## 7. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Simple property extraction | Yes | - |
| Nested property | Yes | - |
| Array index access | Yes | - |
| Optional path | Yes | - |
| Invalid path | Yes | - |
| Path not found | Yes | - |
| Non-JSON response | Yes | Yes |
| Run with extract | - | Yes |
| Manual extract command | - | Yes |
| Variable interpolation | - | Yes |

### Test Data Strategy
- Fixtures for various JSON structures
- Mock response bodies in tests
- ReplState mocks with extractedVars

---

## Definition of Done

- [x] `parseJsonPath()` function implemented
- [x] `evaluateJsonPath()` function implemented
- [x] Error classes: InvalidJsonPathError, JsonPathNotFoundError, ExtractionError
- [x] `extractVariables()` function implemented
- [x] `extractedVars` field added to ReplState
- [x] `runHandler` calls extractor when extract config present
- [x] `extractHandler` and `createExtractCommand()` implemented
- [x] `lastResponseBody` added to ReplState for manual extraction
- [x] Extracted vars integrated into interpolation context
- [x] All 10 BDD scenarios have passing tests
- [x] Lint/typecheck pass
- [ ] TODO_COLLECTIONS.md updated

**Status:** ✅ COMPLETE
