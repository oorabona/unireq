---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: CLI Entry Point with citty (Task 1.2)

## 1. User Stories

### US-1: Command-Line Invocation

```
AS A developer using @unireq/cli
I WANT proper command-line argument parsing with subcommands
SO THAT I can invoke specific CLI operations with consistent syntax

ACCEPTANCE: All commands parse correctly with helpful error messages
```

### US-2: HTTP Verb Shortcuts

```
AS A developer making quick API requests
I WANT shortcut commands for HTTP methods (get, post, put, patch, delete)
SO THAT I can make requests with minimal typing

ACCEPTANCE: unireq get <url> works identically to unireq request GET <url>
```

## 2. Business Rules

### BR-1: Command Structure

- **Invariant:** CLI uses citty (UnJS) for all argument parsing
- **Invariant:** Version comes from package.json (already implemented in index.ts)
- **Effect:** Consistent help output, option validation, subcommand routing

### BR-2: Default Behavior

- **Precondition:** No command specified
- **Effect:** Show help (equivalent to `--help`)
- **Rationale:** User needs guidance on available commands

### BR-3: Request Options

- **Invariant:** `-H, --header` is repeatable (collects to array)
- **Invariant:** `-q, --query` is repeatable (collects to array)
- **Invariant:** `-b, --body` accepts string or `@filepath` syntax
- **Effect:** Options are parsed but NOT executed (execution is Task 1.4)

### BR-4: Error Handling

- **Precondition:** Unknown command or missing required argument
- **Effect:** citty shows error with usage hint
- **Effect:** Exit code 1 for errors

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Dependencies | Add citty to catalog + cli deps | pnpm install succeeds |
| CLI Entry | Replace manual parsing with citty | All scenarios pass |
| Types | Add ParsedRequest interface | TypeScript compiles |
| Tests | Unit tests for command parsing | vitest passes |

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Version Display

```gherkin
Scenario: Display version with --version flag
  Given the CLI is installed
  When I run "unireq --version"
  Then the output shows version from package.json
  And exit code is 0
```

### Scenario 2: Help Display

```gherkin
Scenario: Display help with --help flag
  Given the CLI is installed
  When I run "unireq --help"
  Then the output lists all commands (repl, request, get, post, put, patch, delete)
  And the output lists global options
  And exit code is 0
```

### Scenario 3: Default to Help

```gherkin
Scenario: Show help when no command given
  Given the CLI is installed
  When I run "unireq" with no arguments
  Then the output shows help information
  And exit code is 0
```

### Scenario 4: REPL Command Placeholder

```gherkin
Scenario: REPL command shows placeholder
  Given the CLI is installed
  When I run "unireq repl"
  Then the output indicates REPL mode (placeholder message)
  And exit code is 0
```

### Scenario 5: Request Command Parsing

```gherkin
Scenario: Parse request command with method and URL
  Given the CLI is installed
  When I run "unireq request GET https://api.example.com/users"
  Then the method "GET" is parsed
  And the URL "https://api.example.com/users" is parsed
  And exit code is 0
```

### Scenario 6: HTTP Verb Shortcuts

```gherkin
Scenario: GET shortcut parses correctly
  Given the CLI is installed
  When I run "unireq get https://api.example.com/users"
  Then the method "GET" is inferred
  And the URL "https://api.example.com/users" is parsed
  And exit code is 0
```

### Scenario 7: Request Options Parsing

```gherkin
Scenario: Parse headers and body options
  Given the CLI is installed
  When I run "unireq post /users -H 'Content-Type: application/json' -H 'Accept: application/json' -b '{"name":"test"}'"
  Then two headers are collected
  And the body '{"name":"test"}' is captured
  And exit code is 0
```

### Scenario 8: Missing Required URL

```gherkin
Scenario: Error on missing URL argument
  Given the CLI is installed
  When I run "unireq get" without URL
  Then an error message indicates URL is required
  And exit code is 1
```

### Scenario 9: Unknown Command

```gherkin
Scenario: Error on unknown command
  Given the CLI is installed
  When I run "unireq foo"
  Then an error message indicates unknown command
  And exit code is 1
```

### Scenario 10: Global Options

```gherkin
Scenario: Parse global timeout option
  Given the CLI is installed
  When I run "unireq get https://api.example.com --timeout 5000"
  Then timeout option is set to 5000
  And exit code is 0
```

## 5. Implementation Plan

### Block 1: Dependencies and Types

**Packages:** packages/cli, pnpm-workspace.yaml

**Tasks:**
- Add `citty` to pnpm catalog (latest version 0.1.6)
- Add `citty` to cli package.json dependencies
- Create `src/types.ts` with ParsedRequest interface

**Files:**
- `pnpm-workspace.yaml` - add citty to catalog
- `packages/cli/package.json` - add citty dependency
- `packages/cli/src/types.ts` - new file with types

**Acceptance criteria covered:** Prerequisites for all

**Complexity:** S (small)
**Dependencies:** None

### Block 2: citty Main Command Setup

**Packages:** packages/cli

**Tasks:**
- Create `src/commands/main.ts` with main citty command
- Configure version, description, help
- Add global options (--timeout, --trace, --raw, --no-color)
- Wire up in `src/cli.ts`

**Files:**
- `packages/cli/src/commands/main.ts` - new file
- `packages/cli/src/cli.ts` - update to use citty

**Acceptance criteria covered:** #1, #2, #3

**Complexity:** S (small)
**Dependencies:** Block 1

### Block 3: REPL and Request Commands

**Packages:** packages/cli

**Tasks:**
- Add `repl` command (placeholder action)
- Add `request <method> <url>` command with options
- Implement option collection for -H, -q, -b

**Files:**
- `packages/cli/src/commands/repl.ts` - new file
- `packages/cli/src/commands/request.ts` - new file
- `packages/cli/src/commands/main.ts` - register subcommands

**Acceptance criteria covered:** #4, #5, #7, #8

**Complexity:** M (medium)
**Dependencies:** Block 2

### Block 4: HTTP Verb Shortcuts

**Packages:** packages/cli

**Tasks:**
- Add get, post, put, patch, delete commands
- Share options with request command
- Map to request handler with inferred method

**Files:**
- `packages/cli/src/commands/shortcuts.ts` - new file with all verbs
- `packages/cli/src/commands/main.ts` - register shortcuts

**Acceptance criteria covered:** #6, #10

**Complexity:** S (small)
**Dependencies:** Block 3

### Block 5: Tests

**Packages:** packages/cli

**Tasks:**
- Unit tests for command parsing
- Test option collection
- Test error cases

**Files:**
- `packages/cli/src/__tests__/commands.test.ts` - new file

**Acceptance criteria covered:** All (#1-#10)

**Complexity:** M (medium)
**Dependencies:** Blocks 1-4

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| #1 Version display | Yes | - | - |
| #2 Help display | Yes | - | - |
| #3 Default to help | Yes | - | - |
| #4 REPL placeholder | Yes | - | - |
| #5 Request parsing | Yes | - | - |
| #6 HTTP shortcuts | Yes | - | - |
| #7 Options parsing | Yes | - | - |
| #8 Missing URL error | Yes | - | - |
| #9 Unknown command | Yes | - | - |
| #10 Global options | Yes | - | - |

### Test Approach

- **Unit tests:** Test citty command parsing in isolation
- **Integration:** Deferred to Task 1.4 (when execution is implemented)
- **E2E:** Deferred to Task 8.1 (E2E tests with mock server)

### Mocking Strategy

- No mocks needed - test command parsing output directly
- Use citty's `runCommand` with test arguments
- Capture parsed options via command run handlers

---

## Definition of Done

- [x] All 5 blocks implemented
- [x] All 10 BDD scenarios have passing tests (11 total including edge case)
- [x] pnpm install succeeds
- [x] pnpm -r build succeeds
- [x] pnpm --filter @unireq/cli type-check succeeds
- [x] pnpm biome check packages/cli succeeds
- [x] pnpm --filter @unireq/cli test succeeds
- [x] TODO_CLI_CORE.md updated (Task 1.2 marked done)
