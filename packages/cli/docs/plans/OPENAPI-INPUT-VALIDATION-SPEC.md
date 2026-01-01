---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: OpenAPI Input Validation - Soft Mode (Task 3.6)

## 1. User Stories

### US-1: Parameter Validation Warnings
**AS A** CLI user making API requests against an OpenAPI-documented API
**I WANT** the CLI to warn me when my request parameters don't match the spec
**SO THAT** I can catch errors before sending malformed requests

**ACCEPTANCE:** Warnings displayed but request still executes (soft mode)

## 2. Business Rules

### BR-1: Validation Scope
- Validate path parameters (from URL path segments)
- Validate query parameters (from `-q key=value` options)
- Validate header parameters (from `-H key:value` options)
- Validate request body presence (when required by spec)
- Skip cookie parameters (not commonly used in CLI context)

### BR-2: Soft Mode Behavior
- Validation warnings are displayed to the user
- Request execution is **never blocked** by validation failures
- Warnings use distinct visual formatting (yellow/warning color)
- Multiple warnings can be displayed for a single request

### BR-3: Validation Types

| Check | Validates | Example Warning |
|-------|-----------|-----------------|
| Required | Missing required parameter | `⚠ Missing required path parameter: id` |
| Type | Value type mismatch | `⚠ Path parameter 'id' should be integer, got 'abc'` |
| Enum | Value not in allowed set | `⚠ Query parameter 'status' must be one of: pending, shipped` |
| Format | Format hint (informational) | `⚠ Query parameter 'date' should be date-time format` |

### BR-4: Type Mapping

| OpenAPI Type | Valid JavaScript Values |
|--------------|------------------------|
| `integer` | String parseable as integer (e.g., "123") |
| `number` | String parseable as number (e.g., "3.14") |
| `boolean` | "true", "false", "1", "0" |
| `string` | Any string value |
| `array` | Comma-separated values (for query params) |

### BR-5: Graceful Degradation
- No OpenAPI spec loaded → skip validation silently
- Path not in spec → skip validation for that path
- Operation not found → skip validation for that method
- Parameter has no schema → skip type validation for that param
- Validation error (internal) → log debug, continue without validation

### BR-6: Integration Point
Validation occurs **before** request execution in `executeRequest()`:
1. Receive ParsedRequest
2. Look up operation in NavigationTree
3. Extract operation parameters from OpenAPIDocument
4. Validate request against parameters
5. Display warnings (if any)
6. Execute request

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| openapi/validator.ts | NEW: Validation module | Unit tests |
| openapi/types.ts | Add ValidationResult types | TypeScript |
| executor.ts | Integrate validation call | Integration tests |
| openapi/index.ts | Export validator | N/A |

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Missing Required Path Parameter
```gherkin
Given an OpenAPI spec with path "/users/{id}" where id is required
And user executes "GET /users/" (empty id)
When validation runs
Then warning "Missing required path parameter: id" is displayed
And the request is executed
```

### Scenario 2: Missing Required Query Parameter
```gherkin
Given an OpenAPI spec with GET /orders requiring query param "status"
And user executes "GET /orders" without -q status=...
When validation runs
Then warning "Missing required query parameter: status" is displayed
And the request is executed
```

### Scenario 3: Invalid Enum Value
```gherkin
Given an OpenAPI spec with query param "status" enum ["pending", "shipped"]
And user executes "GET /orders -q status=invalid"
When validation runs
Then warning "Query parameter 'status' must be one of: pending, shipped" is displayed
And the request is executed
```

### Scenario 4: Type Mismatch - Integer
```gherkin
Given an OpenAPI spec with path param "id" type integer
And user executes "GET /users/abc"
When validation runs
Then warning "Path parameter 'id' should be integer, got 'abc'" is displayed
And the request is executed
```

### Scenario 5: Type Mismatch - Number
```gherkin
Given an OpenAPI spec with query param "price" type number
And user executes "GET /products -q price=expensive"
When validation runs
Then warning "Query parameter 'price' should be number, got 'expensive'" is displayed
And the request is executed
```

### Scenario 6: Missing Required Request Body
```gherkin
Given an OpenAPI spec with POST /users requiring a request body
And user executes "POST /users" without -b body
When validation runs
Then warning "Missing required request body" is displayed
And the request is executed
```

### Scenario 7: No OpenAPI Spec Loaded
```gherkin
Given no OpenAPI spec is loaded in the session
And user executes "GET /users"
When request is prepared
Then no validation warnings are displayed
And the request is executed normally
```

### Scenario 8: Path Not in Spec
```gherkin
Given an OpenAPI spec without path "/custom"
And user executes "GET /custom"
When validation runs
Then no validation warnings are displayed
And the request is executed
```

### Scenario 9: Optional Parameter Missing (No Warning)
```gherkin
Given an OpenAPI spec with optional query param "limit"
And user executes "GET /users" without -q limit=...
When validation runs
Then no warning is displayed for limit
And the request is executed
```

### Scenario 10: Valid Request (No Warnings)
```gherkin
Given an OpenAPI spec with required path param "id" type integer
And user executes "GET /users/123"
When validation runs
Then no validation warnings are displayed
And the request is executed
```

## 5. Implementation Plan

### Block 1: Validation Types and Core Logic
**Packages:** cli

- **Types:** Add to `openapi/validator/types.ts`:
  - `ValidationWarning` interface (type, location, param, message)
  - `ValidationResult` interface (warnings array)
  - `ValidatorContext` interface (operation, request data)
- **Validators:** Create `openapi/validator/validators.ts`:
  - `validateRequired(params, provided)` - check required params
  - `validateType(schema, value)` - check type compatibility
  - `validateEnum(schema, value)` - check enum membership
- **Tests:** Unit tests for each validator function

**Complexity:** M
**Acceptance criteria covered:** None directly (infrastructure)

### Block 2: Parameter Extraction and Validation Orchestration
**Packages:** cli

- **Extractor:** Create `openapi/validator/extractor.ts`:
  - `extractPathParams(url, pathTemplate)` - extract values from URL
  - `extractQueryParams(query)` - parse query string pairs
  - `extractHeaderParams(headers)` - parse header pairs
- **Orchestrator:** Create `openapi/validator/index.ts`:
  - `validateRequest(context)` - main entry point
  - Collect warnings from all validators
  - Return ValidationResult
- **Tests:** Unit tests for extraction and orchestration

**Complexity:** M
**Acceptance criteria covered:** #1, #2, #3, #4, #5, #6

### Block 3: Integration with Executor
**Packages:** cli

- **Integration:** Modify `executor.ts`:
  - Import validator module
  - Call validation before execution
  - Display warnings with colored output
- **Warning Display:** Create `openapi/validator/display.ts`:
  - `displayWarnings(warnings)` - format and output warnings
- **Tests:** Integration tests for end-to-end validation flow

**Complexity:** S
**Acceptance criteria covered:** #7, #8, #9, #10

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Required path param missing | Yes | Yes |
| Required query param missing | Yes | Yes |
| Invalid enum value | Yes | Yes |
| Type mismatch (integer) | Yes | Yes |
| Type mismatch (number) | Yes | Yes |
| Missing required body | Yes | Yes |
| No spec loaded | - | Yes |
| Path not in spec | - | Yes |
| Optional param missing | Yes | Yes |
| Valid request | Yes | Yes |

### Test Data Strategy
- Use existing petstore-like fixtures from loader tests
- Create minimal specs for specific validation scenarios
- Mock console output for warning display tests

---

## Definition of Done

- [x] All blocks implemented
- [x] All BDD scenarios have passing tests
- [x] All tests pass (95 validator tests)
- [x] Lint/typecheck pass
- [x] Documentation updated (TODO_OPENAPI.md)

**Note:** Executor integration (Block 3) is deferred pending loaded spec availability in executor context. Added to TODO_OPENAPI.md as pending task.
