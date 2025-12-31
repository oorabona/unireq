---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: REPL Command Parsing (Task 1.5)

## 1. User Stories

### US-1: Execute HTTP GET in REPL

**AS A** developer using @unireq/cli REPL
**I WANT** to type `get https://api.example.com/users` in the REPL
**SO THAT** I can quickly fetch data without leaving interactive mode

**ACCEPTANCE:** GET request executes and response displays

### US-2: Execute HTTP POST with Body

**AS A** developer using @unireq/cli REPL
**I WANT** to type `post /api/users {"name":"Alice"}` with inline JSON
**SO THAT** I can send data without complex command-line escaping

**ACCEPTANCE:** POST request with JSON body executes

### US-3: Add Headers and Query Parameters

**AS A** developer using @unireq/cli REPL
**I WANT** to add `-H "Authorization:Bearer token"` or `-q "page=1"` flags
**SO THAT** I can customize requests with auth headers and query params

**ACCEPTANCE:** Request includes specified headers and query params

---

## 2. Business Rules

### HTTP Method Recognition

- Methods are case-insensitive: `get`, `GET`, `Get` all valid
- Supported methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Unknown methods produce clear error with valid methods list

### Input Parsing Rules

- Format: `<method> <url> [body] [options]`
- URL is required after method
- Body is optional inline JSON (for POST/PUT/PATCH)
- Options: `-H key:value`, `--header key:value`, `-q key=value`, `--query key=value`

### Body Handling

- Body for GET/HEAD/OPTIONS: silently ignored (no error)
- Body detection: first non-flag argument that looks like JSON (`{...}` or `[...]`)
- Invalid JSON body: error with clear message

### Error Handling

- All parsing errors display clear message via consola.error
- REPL continues after errors (no exit)

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| REPL Commands | New `parseHttpCommand()` function |
| REPL Commands | HTTP method command handlers (get, post, etc.) |
| REPL Commands | Updated `createDefaultRegistry()` to include HTTP commands |
| Types | `ParsedHttpInput` interface for REPL-specific parsing |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Basic GET Request

```gherkin
Scenario: Execute GET request in REPL
  Given the REPL is running
  When user types "get https://httpbin.org/get"
  Then HTTP GET request is executed
  And response is displayed
```

### S-2: POST with Inline JSON Body

```gherkin
Scenario: Execute POST with JSON body
  Given the REPL is running
  When user types "post https://httpbin.org/post {"name":"test"}"
  Then HTTP POST request is executed with JSON body
  And Content-Type is application/json
```

### S-3: GET with Header Flag

```gherkin
Scenario: GET request with authorization header
  Given the REPL is running
  When user types "get /api -H "Authorization:Bearer token123""
  Then HTTP GET includes Authorization header
```

### S-4: GET with Query Parameters

```gherkin
Scenario: GET request with query parameters
  Given the REPL is running
  When user types "get /api -q "page=1" -q "limit=10""
  Then HTTP GET includes query string "?page=1&limit=10"
```

### S-5: Invalid Method Error

```gherkin
Scenario: Unknown HTTP method shows error
  Given the REPL is running
  When user types "foo /bar"
  Then error message shows "Unknown command: foo"
```

### S-6: Missing URL Error

```gherkin
Scenario: Method without URL shows error
  Given the REPL is running
  When user types "get"
  Then error message shows "URL is required"
```

### S-7: Invalid Header Format Error

```gherkin
Scenario: Invalid header format shows error
  Given the REPL is running
  When user types "get /api -H "badformat""
  Then error message shows "Invalid header format"
```

### S-8: Case-Insensitive Methods

```gherkin
Scenario: Methods are case-insensitive
  Given the REPL is running
  When user types "GET /api" or "Get /api" or "get /api"
  Then all execute as HTTP GET
```

---

## 5. Implementation Plan

### Block 1: HTTP Command Parser

**Files:**
- `src/repl/http-parser.ts` (NEW)
- `src/__tests__/http-parser.test.ts` (NEW)

**Deliverables:**
- `parseHttpCommand(args: string[]): ParsedRequest` function
- Parses: method (from command name), URL, body, -H, -q flags
- Returns `ParsedRequest` compatible with `executeRequest()`

**Acceptance criteria covered:** S-6, S-7, S-8

### Block 2: HTTP Command Handlers

**Files:**
- `src/repl/http-commands.ts` (NEW)
- `src/__tests__/http-commands.test.ts` (NEW)
- `src/repl/commands.ts` (MODIFY)

**Deliverables:**
- `createHttpHandler(method: HttpMethod): CommandHandler`
- Registers: get, post, put, patch, delete, head, options
- Updated `createDefaultRegistry()` to include HTTP commands

**Acceptance criteria covered:** S-1, S-2, S-3, S-4, S-5

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Basic GET | Yes (parser) | - |
| S-2: POST with body | Yes (parser) | - |
| S-3: GET with header | Yes (parser) | - |
| S-4: GET with query | Yes (parser) | - |
| S-5: Invalid method | Yes (handler) | - |
| S-6: Missing URL | Yes (parser) | - |
| S-7: Invalid header | Yes (parser) | - |
| S-8: Case-insensitive | Yes (parser) | - |

### Test Data

- Mock `executeRequest` in unit tests (don't make real HTTP calls)
- Test with various input patterns

---

## Definition of Done

- [ ] Block 1: HTTP command parser implemented with tests
- [ ] Block 2: HTTP command handlers registered in REPL
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (unit)
- [ ] Lint/typecheck pass
- [ ] TODO updated
