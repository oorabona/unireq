---
doc-meta:
  status: canonical
  scope: cli-core
  type: spec
  created: 2026-01-08
  updated: 2026-01-08
---

# Response Variable System (`_`) - Specification

## Overview

Enable developers to access the last HTTP response via a built-in `_` pseudo-variable with dot-access notation, shell escape (`!cmd`), and piping (`| cmd`).

## BDD Scenarios

### Feature: `_` Variable Access

```gherkin
Scenario: Access status code after HTTP request
  Given I have executed "get https://httpbin.org/status/200"
  When I type "echo _.status"
  Then I should see "200"

Scenario: Access header with case-insensitive lookup
  Given I have executed "get https://httpbin.org/headers"
  When I type "echo _.headers.Content-Type"
  Then I should see "application/json"
  And typing "echo _.headers.content-type" produces the same result

Scenario: Access JSON body with path
  Given I have executed "get https://httpbin.org/json"
  And the response body is {"slideshow": {"title": "Sample"}}
  When I type "echo _.body.slideshow.title"
  Then I should see "Sample"

Scenario: Access timing information
  Given I have executed "get https://httpbin.org/delay/1"
  When I type "echo _.timing.total"
  Then I should see a number >= 1000

Scenario: Access full response body
  Given I have executed "get https://httpbin.org/json"
  When I type "echo _.body"
  Then I should see the full JSON response

Scenario: Error when no prior response
  Given I have not executed any HTTP request
  When I type "echo _.status"
  Then I should see error "No response available. Execute a request first."
```

### Feature: Shell Escape (`!cmd`)

```gherkin
Scenario: Execute shell command
  When I type "!echo hello world"
  Then I should see "hello world"

Scenario: Shell command with arguments
  When I type "!ls -la /tmp"
  Then I should see directory listing

Scenario: Shell command not found
  When I type "!nonexistentcmd123"
  Then I should see error containing "command not found" or "not found"

Scenario: Shell command with stderr
  When I type "!ls /nonexistent"
  Then I should see error from stderr
```

### Feature: Piping (`| cmd`)

```gherkin
Scenario: Pipe body to jq
  Given I have executed "get https://httpbin.org/json"
  And jq is installed
  When I type "_.body | jq '.slideshow.title'"
  Then I should see "Sample" (jq output)

Scenario: Pipe status to cat
  Given I have executed "get https://httpbin.org/status/201"
  When I type "_.status | cat"
  Then I should see "201"

Scenario: Pipe from HTTP command directly
  Given jq is installed
  When I type "get https://httpbin.org/json | jq '.slideshow'"
  Then I should see the slideshow object formatted by jq

Scenario: Pipe to nonexistent command
  Given I have executed "get https://httpbin.org/json"
  When I type "_.body | nonexistentcmd"
  Then I should see error "Command not found: nonexistentcmd"
```

### Feature: Variable Storage (`set`)

```gherkin
Scenario: Store extracted value
  Given I have executed "get https://httpbin.org/json"
  When I type "set title = _.body.slideshow.title"
  Then I should see "Stored: title = Sample"
  And "vars" shows title in the list

Scenario: Use stored variable in request
  Given I have set "userId" to "123"
  When I type "get /users/{{userId}}"
  Then the URL should resolve to "/users/123"

Scenario: Overwrite existing variable
  Given I have set "token" to "abc"
  When I type "set token = _.body.newToken"
  Then token should be updated
  And "vars" shows the new value
```

### Feature: Built-in `echo` Command

```gherkin
Scenario: Echo expression result
  Given I have executed "get https://httpbin.org/status/200"
  When I type "echo _.status"
  Then I should see "200"

Scenario: Echo string literal
  When I type "echo hello"
  Then I should see "hello"

Scenario: Echo with no argument
  When I type "echo"
  Then I should see empty line or usage hint
```

## Implementation Plan

### Block 1: Expression Evaluator (Core)

**Files:**
- `src/repl/expression.ts` (new)
- `src/repl/expression.test.ts` (new)

**Tasks:**
1. Create `ResponseContext` interface wrapping ReplState response fields
2. Implement `evaluateExpression(expr: string, ctx: ResponseContext): unknown`
3. Support `_`, `_.status`, `_.statusText`, `_.headers`, `_.body`, `_.timing`
4. Support `_.headers.<name>` with case-insensitive lookup
5. Support `_.body.<path>` using existing JSONPath extractor
6. Handle errors gracefully (no response, path not found)

**Tests:**
- Unit tests for all expression patterns
- Error cases (no response, invalid path)

### Block 2: `echo` Command

**Files:**
- `src/repl/commands.ts` (modify)
- `src/repl/command-schema.ts` (add schema)

**Tasks:**
1. Add `echo` command handler
2. Parse argument as expression
3. Evaluate and display result
4. Handle primitives, objects, arrays

**Tests:**
- Integration test: echo _.status after request
- echo with JSON body path

### Block 3: Shell Escape (`!cmd`)

**Files:**
- `src/repl/shell.ts` (new)
- `src/repl/shell.test.ts` (new)
- `src/repl/commands.ts` (modify parseInput)

**Tasks:**
1. Detect `!` prefix in parseInput
2. Extract command and arguments
3. Spawn with `child_process.spawn(cmd, args, { shell: true })`
4. Stream stdout/stderr to console
5. Handle command not found error

**Tests:**
- !echo hello
- !ls nonexistent (stderr handling)
- !nonexistent (command not found)

### Block 4: Piping (`| cmd`)

**Files:**
- `src/repl/shell.ts` (extend)
- `src/repl/commands.ts` (modify parseInput)

**Tasks:**
1. Detect `|` in input (not inside quotes)
2. Split into left expression and right command
3. Evaluate left side (expression or command output)
4. Spawn right side, pipe stdin
5. Handle errors on both sides

**Tests:**
- _.body | jq '.'
- _.status | cat
- get /api | jq '.'

### Block 5: `set` Command

**Files:**
- `src/repl/commands.ts` (modify)
- `src/repl/command-schema.ts` (add schema)

**Tasks:**
1. Add `set` command handler
2. Parse `set <name> = <expression>`
3. Evaluate expression
4. Store in `state.extractedVars`
5. Display confirmation

**Tests:**
- set token = _.body.token
- vars shows stored variable
- Overwrite existing variable

### Block 6: Integration & Polish

**Tasks:**
1. Update help text for new commands
2. Add autocomplete for `_` expressions
3. Update COMMANDS.md documentation
4. Run full test suite

## Test Requirements

| Block | Unit Tests | Integration Tests |
|-------|------------|-------------------|
| Expression Evaluator | 15+ | 5 |
| echo Command | 5 | 3 |
| Shell Escape | 8 | 4 |
| Piping | 10 | 5 |
| set Command | 5 | 3 |

## Dependencies

- No new external dependencies
- Uses existing JSONPath extractor from `collections/extractor.ts`
- Uses Node.js `child_process` (built-in)

## Security Considerations

1. **Shell Escape:** User explicitly opts in with `!` prefix
2. **No auto-interpolation:** `!echo _.status` prints literal `_.status`, not value
3. **Piping:** Left side is evaluated by unireq, not shell
4. **Input validation:** Variable names must be alphanumeric

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Shell injection | User must explicitly use `!`; no hidden shell execution |
| Performance (large bodies) | Streaming for pipes; warn on >10MB |
| Windows compatibility | Use `shell: true` for cross-platform |
