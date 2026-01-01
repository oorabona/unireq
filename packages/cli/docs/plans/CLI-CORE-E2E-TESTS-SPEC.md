---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: E2E Tests with Mock Server (Task 8.1)

## 1. User Stories

### US-1: Verify CLI One-Shot Commands

**AS A** developer maintaining @unireq/cli
**I WANT** E2E tests that run the actual CLI binary as a subprocess
**SO THAT** I can verify the complete user experience from command to output

**ACCEPTANCE:** Tests spawn `node dist/cli.js`, capture stdout/stderr, verify exit codes

### US-2: Verify CLI Output Modes

**AS A** developer maintaining @unireq/cli
**I WANT** E2E tests that verify different output formats
**SO THAT** I can ensure --trace, --output modes work correctly

**ACCEPTANCE:** Tests verify JSON output mode, trace mode output

### US-3: Verify CLI Error Handling

**AS A** developer maintaining @unireq/cli
**I WANT** E2E tests that verify error scenarios from user perspective
**SO THAT** I can ensure errors are displayed correctly with proper exit codes

**ACCEPTANCE:** Tests verify network errors, 4xx/5xx responses, invalid input

---

## 2. Business Rules

### E2E Test Infrastructure

- Tests MUST spawn the CLI as a child process using execa
- Tests MUST NOT import CLI code directly (that's integration testing)
- CLI MUST be built before E2E tests run (`dist/cli.js` must exist)
- Each test spawns a fresh process (no state leakage)

### Mock Server

- Use MSW to intercept HTTP requests at Node.js level
- MSW server starts before tests, stops after
- Handlers reset between tests for isolation

### Output Verification

- Capture stdout and stderr separately
- Exit code 0 for successful HTTP responses (including 4xx/5xx)
- Exit code non-zero for CLI errors (invalid args, network failures)
- Stdout contains response body or formatted output
- Stderr contains error messages

### Test Scope

- One-shot commands only (no REPL - requires TTY)
- HTTP method shortcuts: get, post, put, patch, delete
- Request subcommand: `unireq request GET <url>`
- Global options: --trace, --output, --timeout

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Dependencies | Add execa to devDependencies | Package installs |
| Test Infrastructure | E2E test file + helpers | Tests pass |
| Build | Ensure build before E2E | dist/cli.js exists |
| CI | E2E test script | All tests green |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: GET Request Success

```gherkin
Scenario: Execute GET request via CLI
  Given CLI is built and mock server returns 200 with JSON
  When user runs "unireq get http://test.local/users"
  Then stdout contains the JSON response body
  And exit code is 0
```

### S-2: POST Request with Body

```gherkin
Scenario: Execute POST request with JSON body via CLI
  Given CLI is built and mock server accepts POST
  When user runs "unireq post http://test.local/users -d '{"name":"Bob"}'"
  Then request body is sent to server
  And stdout contains the response
  And exit code is 0
```

### S-3: Request Subcommand

```gherkin
Scenario: Execute request using request subcommand
  Given CLI is built and mock server is running
  When user runs "unireq request GET http://test.local/health"
  Then stdout contains the response
  And exit code is 0
```

### S-4: HTTP Error Response

```gherkin
Scenario: CLI handles 404 response
  Given CLI is built and mock server returns 404
  When user runs "unireq get http://test.local/not-found"
  Then stdout contains "404" status
  And exit code is 0 (server responded, not a CLI error)
```

### S-5: Network Error

```gherkin
Scenario: CLI handles network error
  Given CLI is built and server is unreachable
  When user runs "unireq get http://localhost:99999/fail"
  Then stderr contains error message
  And exit code is non-zero
```

### S-6: Trace Mode

```gherkin
Scenario: CLI shows trace output
  Given CLI is built and mock server is running
  When user runs "unireq --trace get http://test.local/users"
  Then stdout contains timing information
  And stdout contains request details
  And exit code is 0
```

### S-7: JSON Output Mode

```gherkin
Scenario: CLI outputs valid JSON
  Given CLI is built and mock server returns JSON
  When user runs "unireq -o json get http://test.local/users"
  Then stdout is valid parseable JSON
  And exit code is 0
```

### S-8: Custom Headers

```gherkin
Scenario: CLI sends custom headers
  Given CLI is built and mock server echoes headers
  When user runs "unireq get http://test.local/echo -H 'X-Custom:test'"
  Then response shows the custom header was received
  And exit code is 0
```

### S-9: Query Parameters

```gherkin
Scenario: CLI sends query parameters
  Given CLI is built and mock server echoes query
  When user runs "unireq get http://test.local/echo -q 'foo=bar'"
  Then response shows the query parameter was received
  And exit code is 0
```

### S-10: All HTTP Methods

```gherkin
Scenario Outline: CLI supports all HTTP method shortcuts
  Given CLI is built and mock server accepts <method>
  When user runs "unireq <command> http://test.local/resource"
  Then request uses <method> HTTP method
  And exit code is 0

Examples:
  | method  | command |
  | GET     | get     |
  | POST    | post    |
  | PUT     | put     |
  | PATCH   | patch   |
  | DELETE  | delete  |
```

### S-11: Invalid Arguments

```gherkin
Scenario: CLI handles missing URL
  Given CLI is built
  When user runs "unireq get" without URL
  Then stderr contains usage help
  And exit code is non-zero
```

---

## 5. Implementation Plan

### Block 1: E2E Infrastructure Setup

**Packages:** cli

**Files:**
- `package.json` (MODIFY - add execa to devDependencies)
- `src/__tests__/cli.e2e.test.ts` (NEW)
- `src/__tests__/e2e-helpers.ts` (NEW)

**Deliverables:**
- Add execa to devDependencies
- Create runCli() helper function that spawns CLI process
- Setup MSW server for E2E tests
- Implement basic GET test (S-1)

**Acceptance criteria covered:** S-1

**Complexity:** M
**Dependencies:** None

### Block 2: HTTP Methods and Body

**Packages:** cli

**Files:**
- `src/__tests__/cli.e2e.test.ts` (MODIFY)

**Deliverables:**
- POST with body test (S-2)
- Request subcommand test (S-3)
- All HTTP methods test (S-10)

**Acceptance criteria covered:** S-2, S-3, S-10

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Headers and Query Parameters

**Packages:** cli

**Files:**
- `src/__tests__/cli.e2e.test.ts` (MODIFY)

**Deliverables:**
- Custom headers test (S-8)
- Query parameters test (S-9)

**Acceptance criteria covered:** S-8, S-9

**Complexity:** S
**Dependencies:** Block 1

### Block 4: Output Modes

**Packages:** cli

**Files:**
- `src/__tests__/cli.e2e.test.ts` (MODIFY)

**Deliverables:**
- Trace mode test (S-6)
- JSON output mode test (S-7)

**Acceptance criteria covered:** S-6, S-7

**Complexity:** S
**Dependencies:** Block 1

### Block 5: Error Handling

**Packages:** cli

**Files:**
- `src/__tests__/cli.e2e.test.ts` (MODIFY)

**Deliverables:**
- HTTP 404 error test (S-4)
- Network error test (S-5)
- Invalid arguments test (S-11)

**Acceptance criteria covered:** S-4, S-5, S-11

**Complexity:** S
**Dependencies:** Block 1

---

## 6. Test Strategy

### Test Matrix

| Scenario | E2E |
|----------|-----|
| S-1: GET success | Yes |
| S-2: POST with body | Yes |
| S-3: Request subcommand | Yes |
| S-4: HTTP 404 | Yes |
| S-5: Network error | Yes |
| S-6: Trace mode | Yes |
| S-7: JSON output | Yes |
| S-8: Custom headers | Yes |
| S-9: Query params | Yes |
| S-10: All methods | Yes |
| S-11: Invalid args | Yes |

### Test Structure (GWT for E2E)

```typescript
describe('CLI E2E', () => {
  describe('Given CLI is built and mock server is running', () => {
    describe('When GET request is executed', () => {
      it('Then response is displayed and exit code is 0', async () => {
        const result = await runCli(['get', 'http://test.local/users']);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('users');
      });
    });
  });
});
```

### Test Data Strategy

- MSW handlers provide deterministic responses
- No external network calls
- Test fixtures for expected outputs

### E2E Helper Function

```typescript
interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(args: string[]): Promise<CliResult> {
  const cliPath = path.join(__dirname, '../../dist/cli.js');
  const result = await execa('node', [cliPath, ...args], {
    reject: false, // Don't throw on non-zero exit
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
```

---

## Definition of Done

- [ ] execa added to devDependencies
- [ ] E2E test file created with runCli helper
- [ ] All 11 BDD scenarios have passing tests
- [ ] Tests run successfully with vitest
- [ ] CLI build verified before tests
- [ ] Lint/typecheck pass
- [ ] TODO_CLI_CORE.md updated
