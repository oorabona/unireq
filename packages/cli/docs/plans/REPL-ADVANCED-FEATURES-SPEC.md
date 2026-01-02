---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2026-01-02
  updated: 2026-01-02
---

# Specification: REPL Advanced Features

## Overview

Replace `@clack/prompts` with Node.js built-in `repl` module to enable shell-like REPL experience with history navigation, tab completion, reverse search, and multiline input.

## 1. User Stories

### US-1: Command History Navigation
**AS A** CLI user
**I WANT** to navigate through my command history using arrow keys
**SO THAT** I can quickly re-execute or modify previous commands

**ACCEPTANCE:** Up/Down arrows cycle through history, Home/End go to oldest/newest

### US-2: Interactive History Search
**AS A** CLI user
**I WANT** to search my command history with Ctrl+R
**SO THAT** I can quickly find and execute commands I've used before

**ACCEPTANCE:** Ctrl+R activates reverse search, typing filters matches

### US-3: Tab Completion
**AS A** CLI user
**I WANT** tab completion for commands, paths, and options
**SO THAT** I can type commands faster with fewer errors

**ACCEPTANCE:** Tab shows matching completions, double-Tab shows all options

### US-4: Multiline Input
**AS A** CLI user
**I WANT** to enter multi-line JSON bodies
**SO THAT** I can compose complex request bodies naturally

**ACCEPTANCE:** Incomplete JSON continues on next line, closing brace completes

## 2. Business Rules

### BR-1: History Persistence
- **Invariant:** History is persisted between sessions
- **Location:** `~/.unireq/repl_history` (global) or `.unireq/repl_history` (workspace)
- **Limit:** Last 1000 entries (configurable)
- **Format:** Plain text, one command per line

### BR-2: Tab Completion Context
- **Empty input:** Show commands
- **After command:** Show relevant completions (paths for cd/ls/HTTP methods, options for others)
- **Path input:** Show matching paths from OpenAPI navigation tree
- **Flags:** Show available options for current command

### BR-3: Multiline Detection
- **Trigger:** Incomplete JSON (unmatched `{` or `[`)
- **Continuation:** REPL shows `...` prompt until balanced
- **Cancel:** Empty line or Ctrl+C cancels multiline mode

### BR-4: History Scope
- Workspace-specific when in workspace
- Global when no workspace
- Command history separate from execution history (NDJSON log)

## 3. Technical Impact

### Layer Changes

| Layer | Component | Changes |
|-------|-----------|---------|
| REPL Engine | `src/repl/engine.ts` | Replace @clack/prompts with Node.js repl |
| Completer | `src/repl/completer.ts` | New file: Tab completion logic |
| History | `src/repl/input-history.ts` | New file: Readline history management |
| State | `src/repl/state.ts` | Add history file path |

### Dependencies

| Action | Package | Reason |
|--------|---------|--------|
| REMOVE | `@clack/prompts` | Replaced by Node.js repl |
| KEEP | `consola` | Output logging |
| KEEP | `citty` | CLI commands (unchanged) |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ReplEngine                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Node.js repl.start({                                   │ │
│  │    prompt: "unireq /path> ",                            │ │
│  │    eval: customEval,      ← parses & executes commands  │ │
│  │    completer: tabComplete, ← uses existing autocomplete │ │
│  │    input: process.stdin,                                 │ │
│  │    output: process.stdout                                │ │
│  │  })                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         ▼                  ▼                  ▼              │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │ Completer  │   │ CommandReg   │   │ InputHistory │       │
│  │ (existing  │   │ (existing)   │   │ (new)        │       │
│  │ autocomplete) │   │              │   │              │       │
│  └────────────┘   └──────────────┘   └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 4. Acceptance Criteria (BDD Scenarios)

### Feature: History Navigation

```gherkin
Scenario: Navigate to previous command
  Given the REPL has history ["ls", "cd /users", "get /users/1"]
  When I press Up arrow
  Then the input shows "get /users/1"

Scenario: Navigate forward in history
  Given I pressed Up twice and input shows "cd /users"
  When I press Down arrow
  Then the input shows "get /users/1"

Scenario: Navigate to oldest command
  Given the REPL has history with 100 entries
  When I press Home
  Then the input shows the oldest command

Scenario: Navigate to newest command
  Given I navigated to older commands
  When I press End
  Then the input is cleared (ready for new command)

Scenario: History persists across sessions
  Given I ran command "get /users"
  And I exited the REPL
  When I start the REPL again
  And I press Up arrow
  Then the input shows "get /users"
```

### Feature: Reverse Search (Ctrl+R)

```gherkin
Scenario: Activate reverse search
  Given the REPL is running
  When I press Ctrl+R
  Then the prompt changes to "(reverse-i-search)`':"

Scenario: Search matches history
  Given history contains ["get /users", "post /orders", "get /products"]
  When I press Ctrl+R and type "get"
  Then the input shows "get /products" (most recent match)

Scenario: Multiple matches
  Given history contains multiple "get" commands
  When I press Ctrl+R repeatedly after finding a match
  Then older matching commands are shown

Scenario: No match found
  Given history does not contain "xyz"
  When I press Ctrl+R and type "xyz"
  Then the prompt shows "(reverse-i-search)`xyz': " with no result
```

### Feature: Tab Completion

```gherkin
Scenario: Complete command name
  Given I typed "hel"
  When I press Tab
  Then the input completes to "help"

Scenario: Complete path after cd
  Given navigation tree has "/users", "/orders"
  And I typed "cd /u"
  When I press Tab
  Then the input completes to "cd /users"

Scenario: Show multiple completions
  Given navigation tree has "/users", "/uploads"
  And I typed "cd /u"
  When I press Tab twice
  Then both "/users" and "/uploads" are shown

Scenario: Complete HTTP method path
  Given navigation tree has "/users/{id}"
  And I typed "get /users/"
  When I press Tab
  Then the input shows "{id}" as completion

Scenario: No completions available
  Given I typed "xyz"
  When I press Tab
  Then nothing happens (no matches)
```

### Feature: Multiline Input

```gherkin
Scenario: Continue incomplete JSON
  Given I typed "post /users {"
  When I press Enter
  Then the prompt changes to "..."
  And I can continue typing on the next line

Scenario: Complete multiline JSON
  Given I am in multiline mode with "{"
  When I type '"name": "Alice"}' and press Enter
  Then the command executes with the complete JSON body

Scenario: Cancel multiline input
  Given I am in multiline mode
  When I press Ctrl+C
  Then multiline mode is cancelled
  And the prompt returns to normal

Scenario: Nested JSON structures
  Given I typed '{"data": {'
  When I press Enter
  Then I remain in multiline mode until all braces are balanced
```

### Feature: History Command

```gherkin
Scenario: View recent history
  Given the REPL has history
  When I type "history"
  Then numbered list of recent commands is displayed

Scenario: Select from history
  Given history shows "5: get /users"
  When I type "!5"
  Then "get /users" is executed
```

## 5. Implementation Plan

### Block 1: Input History Module
**Packages:** cli
**Complexity:** S
**Files:**
- `src/repl/input-history.ts` - History management class
- `src/repl/__tests__/input-history.test.ts` - Unit tests

**Tasks:**
- Create InputHistory class with add/get/persist/load methods
- Handle history file path (workspace vs global)
- Implement max entries limit
- Unit tests for all operations

**Acceptance criteria covered:** Persistence part of #5

### Block 2: Tab Completer Adapter
**Packages:** cli
**Complexity:** S
**Files:**
- `src/repl/completer.ts` - Readline-compatible completer
- `src/repl/__tests__/completer.test.ts` - Unit tests

**Tasks:**
- Create completer function matching Node.js readline signature
- Adapt existing `getSuggestions()` to readline format
- Handle edge cases (empty, no matches)

**Acceptance criteria covered:** #6, #7, #8, #9, #10

### Block 3: Custom Eval Function
**Packages:** cli
**Complexity:** M
**Files:**
- `src/repl/eval.ts` - Custom REPL eval
- `src/repl/__tests__/eval.test.ts` - Unit tests

**Tasks:**
- Create eval function that parses input and executes commands
- Implement multiline detection (Recoverable)
- Handle errors properly
- Return to REPL instead of crashing

**Acceptance criteria covered:** #11, #12, #13, #14

### Block 4: REPL Engine Replacement
**Packages:** cli
**Complexity:** M
**Files:**
- `src/repl/engine.ts` - Replace @clack with Node.js repl
- `src/repl/__tests__/engine.test.ts` - Integration tests

**Tasks:**
- Replace @clack/prompts with Node.js repl.start()
- Wire up completer, eval, history
- Implement history command
- Handle Ctrl+C/Ctrl+D gracefully
- Setup history persistence

**Acceptance criteria covered:** All scenarios

### Block 5: E2E Tests
**Packages:** cli
**Complexity:** S
**Files:**
- `src/repl/__tests__/repl.e2e.test.ts` - End-to-end tests

**Tasks:**
- Test history navigation (simulated keypresses)
- Test tab completion
- Test multiline input
- Test persistence

**Acceptance criteria covered:** Full workflow verification

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| History add/get | Yes | - | - |
| History persist/load | Yes | Yes | - |
| Completer matching | Yes | - | - |
| Completer with OpenAPI | Yes | Yes | - |
| Multiline detection | Yes | - | - |
| Full REPL flow | - | - | Yes |
| Up/Down navigation | - | - | Yes |
| Ctrl+R search | - | - | Yes |

### Test Data Strategy
- Mock filesystem for history persistence
- In-memory navigation tree for completion tests
- PTY simulation for E2E tests (or mock readline)

---

## Definition of Done

- [ ] All blocks implemented
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (unit, integration, e2e)
- [ ] Lint/typecheck pass
- [ ] @clack/prompts removed from dependencies
- [ ] History persists between sessions
- [ ] Tab completion works with OpenAPI paths
- [ ] Multiline JSON input works
- [ ] Documentation updated
