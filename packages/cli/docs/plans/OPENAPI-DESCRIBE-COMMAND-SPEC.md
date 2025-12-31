---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: OpenAPI Describe Command (Task 3.5)

## 1. User Stories

### US-1: Describe Operation at Current Path

**AS A** developer exploring an API
**I WANT** to see detailed information about an operation
**SO THAT** I understand how to use the endpoint

**ACCEPTANCE:** `describe GET` shows parameters, request body, and responses

### US-2: Describe All Methods at Path

**AS A** developer at an endpoint with multiple methods
**I WANT** to see all available operations
**SO THAT** I can choose which one to use

**ACCEPTANCE:** `describe` (no method) shows summary for all methods at current path

### US-3: View Parameter Details

**AS A** developer preparing a request
**I WANT** to see required/optional parameters grouped by location
**SO THAT** I know what data to provide

**ACCEPTANCE:** Parameters grouped as Path, Query, Header with required flag

## 2. Business Rules

### Command Syntax

```
describe [METHOD]
```

- **No argument:** Show overview of all methods at current path
- **With method:** Show detailed info for that specific operation

### Display Rules

1. **No spec loaded:** Show warning with import instructions
2. **Path not in spec:** Show "Path not found" warning
3. **Method not available:** Show "Method not available" with available methods
4. **Deprecated operation:** Show deprecation warning prominently

### Parameter Grouping

Display parameters in this order:
1. **Path parameters** - Required by definition
2. **Query parameters** - With required flag
3. **Header parameters** - With required flag
4. **Cookie parameters** - With required flag (rare)

### Schema Display

For request/response bodies, show:
- Content types available
- Schema type (object, array, string, etc.)
- Required properties (for objects)
- Property names with types (max depth: 2 levels)

## 3. Technical Impact

### Files to Create

| File | Purpose |
|------|---------|
| `src/repl/describe.ts` | Describe command handler and formatting |
| `src/openapi/__tests__/describe.test.ts` | Unit tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/repl/commands.ts` | Register describe command |

### Dependencies

- Uses existing `ReplState.spec` for operation lookup
- Uses existing `ReplState.navigationTree` for path validation
- Uses `consola` for formatted output

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Describe with no spec loaded

```gherkin
Given no OpenAPI spec is loaded
When I run "describe"
Then I see warning "No OpenAPI spec loaded"
And I see hint "Load a spec with: import <url-or-file>"
```

### Scenario 2: Describe all methods at path

```gherkin
Given spec is loaded with /users having GET and POST
And current path is /users
When I run "describe"
Then I see "GET - List all users" with summary
And I see "POST - Create a user" with summary
```

### Scenario 3: Describe specific method

```gherkin
Given spec is loaded with /users/{id} having GET with parameters
And current path is /users/{id}
When I run "describe GET"
Then I see operation summary
And I see "Path Parameters:" with id (required)
And I see "Query Parameters:" if any
And I see "Responses:" with status codes
```

### Scenario 4: Describe with request body

```gherkin
Given spec has POST /users with JSON request body
And current path is /users
When I run "describe POST"
Then I see "Request Body:" section
And I see "Content-Type: application/json"
And I see schema with required properties
```

### Scenario 5: Method not available

```gherkin
Given current path is /users with only GET
When I run "describe DELETE"
Then I see "DELETE not available at /users"
And I see "Available methods: GET"
```

### Scenario 6: Deprecated operation warning

```gherkin
Given operation is marked as deprecated
When I run "describe GET"
Then I see "⚠️ DEPRECATED" warning prominently
And I see operation details
```

### Scenario 7: Path not found

```gherkin
Given spec is loaded
And current path is /nonexistent
When I run "describe"
Then I see "Path not found in spec: /nonexistent"
```

## 5. Implementation Plan

### Block 1: Describe Command Core

**Objective:** Create describe handler with basic operation display

**Tasks:**
- [ ] Create `src/repl/describe.ts` with `describeHandler`
- [ ] Implement "no spec" and "path not found" handling
- [ ] Implement describe all methods (no argument)
- [ ] Register command in `commands.ts`

**Tests:**
- No spec loaded warning
- Path not found warning
- List all methods at path

### Block 2: Detailed Operation Display

**Objective:** Format and display full operation details

**Tasks:**
- [ ] Format parameters by location (path, query, header)
- [ ] Format request body with content types
- [ ] Format responses with status codes
- [ ] Show deprecated warning
- [ ] Show security requirements (if any)

**Tests:**
- Parameter grouping and formatting
- Request body display
- Response display
- Deprecated flag

### Block 3: Schema Formatting

**Objective:** Human-readable schema display

**Tasks:**
- [ ] Format object schemas with properties
- [ ] Format array schemas with item type
- [ ] Show required properties marker
- [ ] Handle nested schemas (max 2 levels)

**Tests:**
- Object schema formatting
- Array schema formatting
- Required properties highlighting

## 6. Test Strategy

### Unit Tests

| Test | Coverage |
|------|----------|
| No spec loaded | Error handling |
| Path not found | Error handling |
| Method not available | Error handling |
| Describe all methods | Overview display |
| Describe specific method | Detail display |
| Parameter formatting | Path/Query/Header grouping |
| Request body formatting | Content types, schema |
| Response formatting | Status codes, descriptions |
| Deprecated operation | Warning display |

### Test Data

Create mock specs with:
- Simple endpoint (GET only)
- CRUD endpoint (GET, POST, PUT, DELETE)
- Endpoint with all parameter types
- Endpoint with request body
- Deprecated endpoint

---

## Definition of Done

- [ ] All blocks implemented
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass
- [ ] Lint/typecheck pass
- [ ] Documentation updated
