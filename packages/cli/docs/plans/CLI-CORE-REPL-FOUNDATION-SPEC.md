---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: REPL Foundation (Task 1.3)

## 1. User Stories

### US-1: Start Interactive REPL

**AS A** developer using @unireq/cli
**I WANT** an interactive REPL mode that accepts commands continuously
**SO THAT** I can explore APIs iteratively without restarting the CLI

**ACCEPTANCE:** REPL starts with welcome message, shows prompt, accepts input in a loop

### US-2: Exit REPL Gracefully

**AS A** developer in REPL mode
**I WANT** to exit the REPL cleanly with the `exit` command
**SO THAT** I can return to my shell without killing the process

**ACCEPTANCE:** `exit` command terminates REPL with goodbye message

### US-3: Error Recovery

**AS A** developer in REPL mode
**I WANT** the REPL to continue after command errors
**SO THAT** a single mistake doesn't force me to restart my session

**ACCEPTANCE:** Errors are displayed but REPL continues accepting input

---

## 2. Business Rules

### Invariants

- REPL must always show a prompt after processing input
- REPL must never exit except on explicit `exit` command or cancel signal
- Current path is always displayed in prompt (defaults to `/`)

### Preconditions

- `unireq repl` command invoked
- Terminal supports interactive input (stdin is TTY)

### Effects

- Welcome message displayed on start
- Goodbye message displayed on exit
- Commands are parsed and dispatched to handlers

### Error Handling

| Error Type | Behavior |
|------------|----------|
| Unknown command | Display "Unknown command: X. Type 'help' for available commands." |
| Command throws | Display error message, continue REPL |
| Empty input | Show prompt again (no error) |
| Whitespace-only | Treat as empty input |

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| CLI Command | Modify `commands/repl.ts` to implement REPL loop | Unit tests |
| REPL Engine | New `repl/engine.ts` module for loop logic | Unit tests |
| Command Registry | New `repl/commands.ts` for built-in commands | Unit tests |
| State Management | New `repl/state.ts` for session state (path) | Unit tests |

---

## 4. Acceptance Criteria (BDD Scenarios)

### US-1: Start Interactive REPL

```gherkin
Scenario: REPL starts with welcome message
  Given the CLI is installed
  When user runs "unireq repl"
  Then a welcome message is displayed
  And a prompt "unireq /> " is shown
  And REPL waits for user input

Scenario: REPL shows current path in prompt
  Given REPL is running
  And current path is "/users"
  When prompt is displayed
  Then prompt shows "unireq /users> "

Scenario: REPL handles empty input
  Given REPL is running
  When user presses Enter without typing
  Then prompt is shown again
  And no error message is displayed
```

### US-2: Exit REPL Gracefully

```gherkin
Scenario: Exit with exit command
  Given REPL is running
  When user types "exit"
  Then goodbye message is displayed
  And REPL terminates with exit code 0

Scenario: Exit with trailing whitespace
  Given REPL is running
  When user types "exit   "
  Then REPL still exits gracefully

Scenario: Cancel input with Ctrl+C
  Given REPL is running
  When user presses Ctrl+C during prompt
  Then current input is cancelled
  And goodbye message is displayed
  And REPL terminates
```

### US-3: Error Recovery

```gherkin
Scenario: Unknown command shows helpful message
  Given REPL is running
  When user types "foobar"
  Then message "Unknown command: foobar. Type 'help' for available commands." is displayed
  And REPL continues with new prompt

Scenario: Help command shows available commands
  Given REPL is running
  When user types "help"
  Then list of available commands is displayed
  And REPL continues with new prompt

Scenario: Command error doesn't crash REPL
  Given REPL is running
  And a command handler throws an error
  When user invokes that command
  Then error message is displayed
  And REPL continues with new prompt

Scenario: Version command shows CLI version
  Given REPL is running
  When user types "version"
  Then CLI version from package.json is displayed
  And REPL continues with new prompt
```

---

## 5. Implementation Plan

### Block 1: REPL Engine Core

**Packages:** @unireq/cli

**Files:**
- `src/repl/engine.ts` - Main REPL loop logic
- `src/repl/state.ts` - Session state (current path)

**Implementation:**
- Create `ReplState` class with `currentPath` property
- Create `runRepl()` function with @clack/prompts loop
- Handle cancel detection with `isCancel()`
- Integrate with consola for output

**Tests:** Unit tests for state management

**Acceptance criteria covered:** US-1 (start, prompt)

**Complexity:** M

---

### Block 2: Command Registry

**Packages:** @unireq/cli

**Files:**
- `src/repl/commands.ts` - Command registry and built-in commands
- `src/repl/types.ts` - Command handler types

**Implementation:**
- Create `CommandRegistry` with `register()` and `execute()` methods
- Implement built-in commands: `help`, `exit`, `version`
- Command signature: `(args: string[], state: ReplState) => Promise<void>`

**Tests:** Unit tests for registry and built-in commands

**Acceptance criteria covered:** US-2 (exit), US-3 (help, error handling)

**Complexity:** S

---

### Block 3: Integration with citty

**Packages:** @unireq/cli

**Files:**
- `src/commands/repl.ts` - Update to use REPL engine

**Implementation:**
- Replace placeholder with `runRepl()` call
- Pass workspace arg to initial state
- Ensure proper async handling

**Tests:** Integration test for full REPL flow

**Acceptance criteria covered:** All scenarios

**Complexity:** S

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| REPL starts with welcome | - | Yes |
| Prompt shows path | Yes | Yes |
| Empty input handling | Yes | - |
| Exit command | Yes | Yes |
| Unknown command | Yes | Yes |
| Help command | Yes | - |
| Error recovery | Yes | Yes |

### Test Data Strategy

- Mock stdin/stdout for unit tests
- Use `@clack/prompts` test utilities if available
- Test command handlers in isolation

### Mocking Strategy

| Component | Mock Strategy |
|-----------|---------------|
| @clack/prompts | Mock `text()` and `isCancel()` for unit tests |
| consola | Use `consola.mockTypes` for output capture |
| process.exit | Mock to prevent test termination |

---

## Definition of Done

- [ ] All 3 blocks implemented
- [ ] All 10 BDD scenarios have passing tests
- [ ] All tests pass (unit + integration)
- [ ] Lint/typecheck pass
- [ ] `unireq repl` starts interactive mode
- [ ] Built-in commands work: help, exit, version
- [ ] Error recovery verified
- [ ] Documentation updated
