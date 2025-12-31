---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Signal Handling (Task 1.8)

## 1. User Stories

### US-1: Exit REPL with Ctrl+D

**AS A** developer using @unireq/cli REPL
**I WANT** to press Ctrl+D to exit the REPL
**SO THAT** I can use the standard Unix EOF signal to quit

**ACCEPTANCE:** REPL exits gracefully with "Goodbye!" message

### US-2: Consistent Exit Behavior

**AS A** developer using @unireq/cli REPL
**I WANT** all exit methods (exit command, Ctrl+C, Ctrl+D) to behave consistently
**SO THAT** I have predictable exit behavior

**ACCEPTANCE:** All exit methods show "Goodbye!" via @clack/prompts outro

---

## 2. Business Rules

### Signal Handling

- Ctrl+D (EOF) during prompt triggers graceful exit
- Ctrl+C during prompt triggers graceful exit (existing via isCancel)
- `exit` command triggers graceful exit (existing)
- All exit paths display "Goodbye!" message via outro()

### @clack/prompts Behavior

- `text()` returns `undefined` when Ctrl+D is pressed (empty EOF)
- `isCancel()` returns true when Ctrl+C is pressed
- Both signals should result in the same graceful exit

### Consistency Rules

1. No duplicate "Goodbye!" messages
2. No error messages on graceful exit
3. REPL loop terminates cleanly

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| REPL Engine | Detect EOF (undefined/empty input) from text() |
| REPL Engine | Unified exit path for all exit methods |
| Tests | Signal handling test scenarios |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Ctrl+D Exits REPL

```gherkin
Scenario: Exit REPL with Ctrl+D
  Given the REPL is running
  When user presses Ctrl+D (EOF)
  Then text() returns undefined or empty string
  And REPL displays "Goodbye!" message
  And REPL loop terminates
```

### S-2: Ctrl+C Exits REPL (verify existing)

```gherkin
Scenario: Exit REPL with Ctrl+C
  Given the REPL is running
  When user presses Ctrl+C
  Then isCancel() returns true
  And REPL displays "Goodbye!" message
  And REPL loop terminates
```

### S-3: Consistent Exit Messages

```gherkin
Scenario: All exit methods show same message
  Given the REPL is running
  When user exits via any method (exit, Ctrl+C, Ctrl+D)
  Then "Goodbye!" message is displayed exactly once
  And no error messages appear
```

### S-4: Ctrl+D After Partial Input

```gherkin
Scenario: Ctrl+D discards partial input
  Given the REPL is running
  And user has typed partial input
  When user presses Ctrl+D
  Then partial input is discarded
  And REPL exits gracefully
```

---

## 5. Implementation Plan

### Block 1: EOF Detection and Exit

**Files:**
- `src/repl/engine.ts` (MODIFY)
- `src/__tests__/repl.test.ts` (MODIFY)

**Deliverables:**
- Detect EOF (undefined or empty string from text())
- Treat EOF same as Ctrl+C (graceful exit)
- Unified exit path using cancel() or outro()

**Acceptance criteria covered:** S-1, S-3, S-4

### Block 2: Verify Existing Ctrl+C Behavior

**Files:**
- `src/__tests__/repl.test.ts` (MODIFY)

**Deliverables:**
- Add explicit test for Ctrl+C behavior
- Verify consistent exit message

**Acceptance criteria covered:** S-2

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Ctrl+D exits | Yes (mock text()) | - |
| S-2: Ctrl+C exits | Yes (mock isCancel) | - |
| S-3: Consistent messages | Yes (verify output) | - |
| S-4: Partial input EOF | Yes (mock text()) | - |

### Test Data

- Mock @clack/prompts text() to return undefined (EOF)
- Mock @clack/prompts isCancel() to return true (Ctrl+C)
- Capture cancel/outro calls

---

## Definition of Done

- [ ] Block 1: EOF detection implemented
- [ ] Block 2: Ctrl+C behavior verified with tests
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (unit)
- [ ] Lint/typecheck pass
- [ ] TODO updated
