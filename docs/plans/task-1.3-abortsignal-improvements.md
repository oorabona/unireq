---
doc-meta:
  status: canonical
  scope: http
  type: specification
  created: 2025-12-30
  updated: 2025-12-30
---

# Specification: AbortSignal Improvements (Task 1.3)

## 1. User Stories

### US-1: Fine-grained Timeout Control

```
AS A developer using @unireq/http for enterprise applications
I WANT to configure separate timeouts for connection, headers, and body phases
SO THAT I can handle slow connections differently from slow response bodies

ACCEPTANCE: timeout({ connect: 2000, headers: 5000, body: 30000 }) applies different timeouts per phase
```

### US-2: Signal Composition

```
AS A developer implementing cancelable requests
I WANT to combine user abort signals with automatic timeouts
SO THAT requests can be cancelled by either user action or timeout

ACCEPTANCE: AbortSignal.any([userSignal, timeoutSignal]) is used for composition
```

### US-3: Native AbortSignal.timeout() Usage

```
AS A developer on Node 20+
I WANT the library to use native AbortSignal.timeout()
SO THAT I benefit from platform optimizations and cleaner code

ACCEPTANCE: Native AbortSignal.timeout() is used when available instead of manual setTimeout
```

---

## 2. Business Rules

### Invariants (Always True)

| ID | Rule |
|----|------|
| INV-1 | `timeout(ms)` MUST remain backward compatible (accepts number) |
| INV-2 | TimeoutError MUST include the timeout duration in `timeoutMs` |
| INV-3 | All timers MUST be cleaned up after request completion or abort |
| INV-4 | Memory leaks from abort listeners MUST be prevented |

### Preconditions

| ID | Condition |
|----|-----------|
| PRE-1 | Node.js >= 20.0.0 for AbortSignal.any() support |
| PRE-2 | AbortSignal.timeout() available (Node 16.14+) |

### Effects

| ID | Action | Effect |
|----|--------|--------|
| EFF-1 | `timeout(5000)` | Creates AbortSignal.timeout(5000), aborts after 5s |
| EFF-2 | `timeout({ total: 5000 })` | Equivalent to `timeout(5000)` |
| EFF-3 | `timeout({ connect: 2000, headers: 5000, body: 30000 })` | Per-phase timeouts with AbortSignal.any() |
| EFF-4 | User signal + timeout | Combined with AbortSignal.any(), first to abort wins |

### Error Handling

| ID | Condition | Error |
|----|-----------|-------|
| ERR-1 | Timeout expires | TimeoutError with phase info |
| ERR-2 | User aborts | DOMException (AbortError) propagated |
| ERR-3 | Network error before timeout | NetworkError (not TimeoutError) |
| ERR-4 | Already aborted signal passed | Immediate rejection |

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | New `TimeoutOptions`, `PhaseTimeouts` interfaces | Type exports in index.ts |
| Policy | Enhanced `timeout()` function in `policies.ts` | Unit tests |
| Errors | TimeoutError extended with `phase` info | Error instanceof checks |
| Index | Export new types | Build + type-check |
| Docs | Update `docs/packages/http.md` | Manual review |

### API Surface

```typescript
// New types
interface PhaseTimeouts {
  readonly connect?: number;
  readonly headers?: number;
  readonly body?: number;
  readonly total?: number;
}

type TimeoutOptions = number | PhaseTimeouts;

// Enhanced function signature
function timeout(options: TimeoutOptions): Policy;
```

---

## 4. Acceptance Criteria (BDD Scenarios)

### Feature: Simple Timeout (Backward Compatibility)

```gherkin
Scenario: AC1-1 Simple numeric timeout works as before
  Given a timeout policy with value 5000
  When a request takes longer than 5000ms
  Then the request MUST be aborted with TimeoutError
  And timeoutMs MUST equal 5000

Scenario: AC1-2 Fast request completes within timeout
  Given a timeout policy with value 5000
  When a request completes in 100ms
  Then the response MUST be returned successfully
  And no TimeoutError MUST be thrown

Scenario: AC1-3 Timeout of 0 aborts immediately
  Given a timeout policy with value 0
  When any request is made
  Then the request MUST be aborted immediately
```

### Feature: Per-Phase Timeouts

```gherkin
Scenario: AC2-1 Total timeout only behaves like simple timeout
  Given a timeout policy with { total: 5000 }
  When a request takes longer than 5000ms total
  Then the request MUST be aborted with TimeoutError

Scenario: AC2-2 Headers timeout triggers before body
  Given a timeout policy with { headers: 1000, body: 10000 }
  When server takes 2000ms to send first header
  Then the request MUST be aborted with TimeoutError
  And error message MUST indicate "headers" phase

Scenario: AC2-3 Body timeout triggers during download
  Given a timeout policy with { headers: 5000, body: 1000 }
  When headers arrive in 500ms but body takes 2000ms
  Then the request MUST be aborted with TimeoutError
  And error message MUST indicate "body" phase

Scenario: AC2-4 Multiple phases combine correctly
  Given a timeout policy with { connect: 2000, headers: 3000, body: 5000, total: 8000 }
  When total time exceeds 8000ms
  Then the request MUST be aborted regardless of individual phase times
```

### Feature: Signal Composition

```gherkin
Scenario: AC3-1 User abort takes precedence over timeout
  Given a timeout policy with value 10000
  And a user AbortController
  When user aborts after 100ms
  Then the request MUST be aborted immediately
  And error MUST be AbortError (not TimeoutError)

Scenario: AC3-2 Timeout fires when user doesn't abort
  Given a timeout policy with value 1000
  And a user AbortController that never aborts
  When request takes 2000ms
  Then the request MUST be aborted with TimeoutError

Scenario: AC3-3 Already aborted user signal rejects immediately
  Given a user AbortController that is already aborted
  When timeout policy is applied
  Then the request MUST reject immediately
```

### Feature: Graceful Cleanup

```gherkin
Scenario: AC4-1 Timer cleanup on success
  Given a timeout policy with value 5000
  When request completes successfully in 100ms
  Then all internal timers MUST be cleared
  And no memory leaks MUST occur

Scenario: AC4-2 Timer cleanup on timeout
  Given a timeout policy with value 100
  When timeout fires
  Then all internal timers MUST be cleared
  And abort listeners MUST be removed

Scenario: AC4-3 Timer cleanup on user abort
  Given a timeout policy with value 5000
  And a user AbortController
  When user aborts after 100ms
  Then all internal timers MUST be cleared
  And no dangling event listeners MUST remain
```

### Feature: Native AbortSignal.timeout Usage

```gherkin
Scenario: AC5-1 Uses AbortSignal.timeout for simple timeout
  Given Node.js version supports AbortSignal.timeout
  When timeout(5000) is called
  Then AbortSignal.timeout(5000) MUST be used internally

Scenario: AC5-2 Uses AbortSignal.any for composition
  Given Node.js version supports AbortSignal.any
  When user signal and timeout are both present
  Then AbortSignal.any([userSignal, timeoutSignal]) MUST be used
```

---

## 5. Implementation Plan (Vertical Slices)

### Block 1: Types and Simple Timeout Enhancement

**Package:** `@unireq/http`
**Files:** `policies.ts`, `index.ts`

- **Types:** Add `PhaseTimeouts`, `TimeoutOptions` interfaces
- **Policy:** Refactor `timeout()` to accept `TimeoutOptions`
- **Logic:** Use `AbortSignal.timeout()` for simple numeric case
- **Tests:** 4 unit tests for AC1-1, AC1-2, AC1-3, AC5-1
- **Acceptance criteria covered:** AC1, AC5-1

**Complexity:** S
**Dependencies:** None

### Block 2: Signal Composition with AbortSignal.any()

**Package:** `@unireq/http`
**Files:** `policies.ts`

- **Logic:** Implement user signal + timeout composition
- **Logic:** Use `AbortSignal.any()` for combining signals
- **Tests:** 3 unit tests for AC3-1, AC3-2, AC3-3
- **Acceptance criteria covered:** AC3, AC5-2

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Per-Phase Timeouts

**Package:** `@unireq/http`
**Files:** `policies.ts`

- **Logic:** Implement phase-specific timeouts (connect, headers, body, total)
- **Logic:** Create composite signal with `AbortSignal.any()` for all phases
- **Logic:** Enhance TimeoutError with phase information
- **Tests:** 4 unit tests for AC2-1, AC2-2, AC2-3, AC2-4
- **Acceptance criteria covered:** AC2

**Complexity:** M
**Dependencies:** Block 1, Block 2

### Block 4: Cleanup and Memory Leak Prevention

**Package:** `@unireq/http`
**Files:** `policies.ts`

- **Logic:** Ensure all timers cleared in finally blocks
- **Logic:** Remove abort listeners on completion
- **Tests:** 3 unit tests for AC4-1, AC4-2, AC4-3
- **Acceptance criteria covered:** AC4

**Complexity:** S
**Dependencies:** Block 1, Block 2, Block 3

### Block 5: Documentation Update

**Package:** `@unireq/http`
**Files:** `docs/packages/http.md`, `README.md`

- **Docs:** Update timeout section with new options
- **Docs:** Add per-phase timeout examples
- **Docs:** Update troubleshooting section

**Complexity:** S
**Dependencies:** Block 1-4

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| AC1-1 Simple timeout | ✅ | - | - |
| AC1-2 Fast request | ✅ | - | - |
| AC1-3 Zero timeout | ✅ | - | - |
| AC2-1 Total only | ✅ | - | - |
| AC2-2 Headers timeout | ✅ | ✅ | - |
| AC2-3 Body timeout | ✅ | ✅ | - |
| AC2-4 Multiple phases | ✅ | - | - |
| AC3-1 User abort | ✅ | - | - |
| AC3-2 Timeout fires | ✅ | - | - |
| AC3-3 Already aborted | ✅ | - | - |
| AC4-1 Cleanup success | ✅ | - | - |
| AC4-2 Cleanup timeout | ✅ | - | - |
| AC4-3 Cleanup abort | ✅ | - | - |
| AC5-1 Native timeout | ✅ | - | - |
| AC5-2 Native any | ✅ | - | - |

### Test Files

- `packages/http/src/__tests__/timeout.test.ts` - New dedicated test file
- Update existing `packages/http/src/__tests__/policies.test.ts`

### Test Data Strategy

- Use `vi.useFakeTimers()` for timing control
- Mock slow transports with configurable delays
- No external dependencies required

### Coverage Target

- Unit: 100% line coverage for new timeout code
- All 15 BDD scenarios covered

---

## Definition of Done

- [ ] All 5 blocks implemented
- [ ] All 15 BDD scenarios have passing tests
- [ ] All tests pass (`pnpm test`)
- [ ] Lint/typecheck pass (`pnpm biome check && pnpm type-check`)
- [ ] Documentation updated (EN only, FR later)
- [ ] Types exported from index.ts
- [ ] Backward compatibility verified
- [ ] No memory leaks (cleanup tests pass)
