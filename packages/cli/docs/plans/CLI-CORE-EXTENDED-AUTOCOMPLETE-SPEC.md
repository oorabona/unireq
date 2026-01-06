---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2026-01-06
  updated: 2026-01-06
---

# Specification: Extended Autocomplete for Subcommands and Flags

## 1. User Stories

### US1: Subcommand Completion

```
AS A CLI user
I WANT autocomplete suggestions for subcommands after typing a command
SO THAT I can discover and complete subcommands without memorizing them

ACCEPTANCE: When I type "profile " and press Tab, I see: configure, list, show, use, etc.
```

### US2: Flag Completion

```
AS A CLI user
I WANT autocomplete suggestions for flags after typing a command or subcommand
SO THAT I can discover available options without reading documentation

ACCEPTANCE: When I type "get " and press Tab, I see: -H, -q, -o, --headers, --query, --output, etc.
```

### US3: Flag Value Completion

```
AS A CLI user
I WANT autocomplete suggestions for flag values when they have known options
SO THAT I can select valid values without guessing

ACCEPTANCE: When I type "get --output " and press Tab, I see: pretty, json, raw
```

## 2. Business Rules

### 2.1 Context Detection

**Invariants:**
- Input is always parsed left-to-right
- Context type depends on the current cursor position
- A word is defined as continuous non-whitespace characters

**Context Types:**

| Context | Detection | Suggestions |
|---------|-----------|-------------|
| `command` | First word, no match yet | Commands + HTTP methods |
| `method` | First word matches HTTP method prefix | HTTP methods |
| `path` | After HTTP method OR starts with `/` | OpenAPI paths |
| `subcommand` | After known command with subcommands | Subcommand names |
| `flag` | After command/subcommand, starts with `-` | Short/long flags |
| `flag_value` | After flag that expects value | Enum values or empty |

**Preconditions:**
- Tab is pressed explicitly (not auto-show for subsequent words)
- Command metadata is available for the first word

**Effects:**
- Suggestions are computed for the current word position
- Selected suggestion replaces current word (not entire input)

**Errors:**
- Unknown command: No suggestions (graceful empty state)
- Invalid position: No suggestions

### 2.2 Command Schema

Each command can define:

```typescript
interface CommandSchema {
  /** Command name */
  name: string;
  /** Available subcommands (optional) */
  subcommands?: SubcommandSchema[];
  /** Available flags (optional) */
  flags?: FlagSchema[];
}

interface SubcommandSchema {
  /** Subcommand name */
  name: string;
  /** Description for autocomplete */
  description?: string;
  /** Subcommand-specific flags (inherits parent flags) */
  flags?: FlagSchema[];
}

interface FlagSchema {
  /** Short flag (e.g., "-H") */
  short?: string;
  /** Long flag (e.g., "--headers") */
  long: string;
  /** Description for autocomplete */
  description?: string;
  /** Whether flag can be repeated */
  repeatable?: boolean;
  /** Flag expects a value */
  takesValue?: boolean;
  /** Enum values for completion */
  values?: string[];
}
```

### 2.3 Flag Tracking

**Rules:**
- Non-repeatable flags used once are excluded from suggestions
- Repeatable flags (e.g., `-H`) are always shown
- Flags after `--` separator are not suggested (positional mode)

### 2.4 Suggestion Priority

1. Subcommands (if command has subcommands and no subcommand entered yet)
2. Flags (sorted: short flags, then long flags, alphabetically)
3. Flag values (if cursor is after a flag that takes enum values)

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | New `CommandSchema`, `FlagSchema` interfaces | Type safety |
| Metadata | New `command-schema.ts` with structured definitions | Test coverage |
| Hook | Extended `parseInputContext()` for flag/subcommand detection | Unit tests |
| Hook | New `matchFlags()`, `matchSubcommands()` functions | Unit tests |
| Hook | Extended `computeSuggestions()` to handle new contexts | Integration tests |
| UI | Tab key handling in CommandLine for explicit trigger | E2E tests |

**Files to Create:**
- `src/repl/command-schema.ts` - Structured command metadata

**Files to Modify:**
- `src/ui/hooks/useAutocomplete.ts` - Extended context parsing and matching
- `src/ui/components/CommandLine.tsx` - Tab key handling

## 4. Acceptance Criteria (BDD Scenarios)

### Nominal Scenarios

```gherkin
Scenario: Subcommand completion
  Given the user has typed "profile "
  When the user presses Tab
  Then suggestions show: "configure", "create", "delete", "edit", "list", "rename", "set", "show", "unset", "use"

Scenario: Subcommand prefix completion
  Given the user has typed "profile con"
  When the user presses Tab
  Then suggestions show: "configure"

Scenario: Flag completion after command
  Given the user has typed "get "
  When the user presses Tab
  Then suggestions show flags: "-H", "-q", "-b", "-t", "-o", "-i", "-S", "-B", "-e", "--header", "--query", etc.

Scenario: Long flag prefix completion
  Given the user has typed "get --he"
  When the user presses Tab
  Then suggestions show: "--header"

Scenario: Short flag prefix completion
  Given the user has typed "get -"
  When the user presses Tab
  Then suggestions show all short flags: "-H", "-q", "-b", "-t", "-o", "-i", "-S", "-B", "-e"

Scenario: Flag value completion
  Given the user has typed "get --output "
  When the user presses Tab
  Then suggestions show: "pretty", "json", "raw"

Scenario: Flag after subcommand
  Given the user has typed "profile create "
  When the user presses Tab
  Then suggestions show: "--from", "--copy-vars", "--copy-secrets", "--copy-all"
```

### Edge Cases

```gherkin
Scenario: No duplicate non-repeatable flags
  Given the user has typed "get -i "
  And "-i" is not repeatable
  When the user presses Tab
  Then suggestions do NOT include "-i" or "--include"

Scenario: Repeatable flag still shown
  Given the user has typed "get -H 'X-Foo: bar' "
  And "-H" is repeatable
  When the user presses Tab
  Then suggestions include "-H" and "--header"

Scenario: Unknown command graceful handling
  Given the user has typed "unknowncmd "
  When the user presses Tab
  Then no suggestions are shown

Scenario: Path after HTTP method (existing behavior)
  Given the user has typed "get /us"
  And OpenAPI spec has path "/users"
  When the user presses Tab
  Then suggestions show: "/users"

Scenario: Mixed context - subcommand takes precedence over flags
  Given the user has typed "workspace "
  And "workspace" has subcommands: "list", "init", "use", etc.
  When the user presses Tab
  Then suggestions show subcommands, not flags
```

### Error Scenarios

```gherkin
Scenario: Empty suggestions gracefully handled
  Given the user has typed "exit "
  And "exit" has no subcommands or flags
  When the user presses Tab
  Then no suggestions are shown
  And no error is thrown

Scenario: Invalid flag prefix ignored
  Given the user has typed "get ---"
  When the user presses Tab
  Then no suggestions are shown
```

## 5. Implementation Plan

### Block 1: Command Schema Definition

**Packages:** `@unireq/cli`

**Files:**
- Create `src/repl/command-schema.ts`

**Tasks:**
- Define `CommandSchema`, `SubcommandSchema`, `FlagSchema` interfaces
- Create `COMMAND_SCHEMAS` constant with structured metadata for all commands
- Extract flag definitions from `help.ts` helpText into structured format
- Export `getCommandSchema(name: string)` function

**Complexity:** M
**Dependencies:** None
**Acceptance criteria covered:** Foundation for all scenarios

**Test Requirements:**
- Unit tests for schema completeness (all commands have schemas)
- Unit tests for `getCommandSchema()` function

### Block 2: Extended Context Parsing

**Packages:** `@unireq/cli`

**Files:**
- Modify `src/ui/hooks/useAutocomplete.ts`

**Tasks:**
- Extend `parseInputContext()` to detect:
  - `subcommand` context (after command with subcommands)
  - `flag` context (word starting with `-`)
  - `flag_value` context (after flag that takes value)
- Parse already-used flags from input
- Return parsed flags in context

**Complexity:** M
**Dependencies:** Block 1
**Acceptance criteria covered:** Context detection for all scenarios

**Test Requirements:**
- Unit tests for each context type detection
- Unit tests for flag parsing from input

### Block 3: Matching Functions

**Packages:** `@unireq/cli`

**Files:**
- Modify `src/ui/hooks/useAutocomplete.ts`

**Tasks:**
- Add `matchSubcommands(input, schema)` function
- Add `matchFlags(input, schema, usedFlags)` function
- Add `matchFlagValues(flag, schema)` function
- Integrate with `computeSuggestions()`

**Complexity:** M
**Dependencies:** Block 1, Block 2
**Acceptance criteria covered:** All suggestion scenarios

**Test Requirements:**
- Unit tests for each matching function
- Unit tests for flag deduplication logic
- Unit tests for repeatable flag handling

### Block 4: Tab Key Handling

**Packages:** `@unireq/cli`

**Files:**
- Modify `src/ui/components/CommandLine.tsx`

**Tasks:**
- Add explicit Tab key handler in `useInput`
- Call `show()` when Tab pressed and position > 0
- Ensure Tab doesn't trigger for first word (keep existing auto-show)

**Complexity:** S
**Dependencies:** Block 3
**Acceptance criteria covered:** Tab trigger scenarios

**Test Requirements:**
- Integration test for Tab key behavior
- Test that first word still auto-shows

### Block 5: Integration and E2E Tests

**Packages:** `@unireq/cli`

**Files:**
- Create `src/ui/hooks/__tests__/useAutocomplete-extended.test.ts`
- Add tests to `src/ui/components/__tests__/CommandLine.test.tsx`

**Tasks:**
- Integration tests for full flow (input → context → suggestions)
- E2E tests for Tab behavior in CommandLine
- Test all BDD scenarios

**Complexity:** M
**Dependencies:** Blocks 1-4
**Acceptance criteria covered:** All scenarios

**Test Requirements:**
- All BDD scenarios implemented as tests
- Edge case tests
- Error scenario tests

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Subcommand completion | Yes | Yes | Yes |
| Flag completion | Yes | Yes | Yes |
| Flag value completion | Yes | Yes | Yes |
| Non-repeatable flag exclusion | Yes | Yes | - |
| Repeatable flag inclusion | Yes | Yes | - |
| Unknown command | Yes | Yes | - |
| Tab key trigger | - | Yes | Yes |
| First word auto-show (existing) | - | Yes | - |

### Test Data Strategy

**Fixtures:**
- `testCommandSchemas` - Subset of real schemas for testing
- `testPaths` - Mock OpenAPI paths

**Mocks:**
- No external mocks needed (all logic is client-side)

### Coverage Target

- Unit: 90%+ for new code
- Integration: All BDD scenarios
- E2E: Tab behavior verification

---

## Definition of Done

- [ ] Block 1: Command schema definition complete with tests
- [ ] Block 2: Extended context parsing complete with tests
- [ ] Block 3: Matching functions complete with tests
- [ ] Block 4: Tab key handling complete with tests
- [ ] Block 5: All BDD scenarios have passing tests
- [ ] All tests pass (`pnpm test:cli`)
- [ ] Lint/typecheck pass (`pnpm lint:cli && pnpm type-check:cli`)
- [ ] Documentation updated (TODO_CLI_CORE.md)
