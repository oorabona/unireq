---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2026-01-03
  updated: 2026-01-04
---

# Specification: Ink-based Terminal UI (Claude Code-like UX)

## 1. User Stories

### US-1: Persistent Status Header

**AS A** developer exploring an API
**I WANT** to see workspace, auth status, and last request info at a glance
**SO THAT** I have full context without running status commands

**ACCEPTANCE:** A sticky header line shows: `workspace · cwd · auth · lastStatus · lastTime`

### US-2: Scrollable Transcript

**AS A** developer running multiple requests
**I WANT** a scrollable history of commands and results
**SO THAT** I can review previous responses without re-running

**ACCEPTANCE:** Commands, results, and errors appear in a scrollback buffer

### US-3: Keyboard Inspectors

**AS A** power user
**I WANT** keyboard shortcuts to inspect the last response, browse history, and get help
**SO THAT** I can work efficiently without typing verbose commands

**ACCEPTANCE:** `i`=inspect, `h`=history picker, `?`=contextual help

### US-4: External Editor for Multiline Input

**AS A** developer sending complex JSON payloads
**I WANT** to use my preferred editor for multiline input
**SO THAT** I can compose large bodies comfortably

**ACCEPTANCE:** `Ctrl+E` or `/edit` opens `$EDITOR`, returns content to CLI

### US-5: OpenAPI-aware Autocomplete

**AS A** developer with an OpenAPI spec loaded
**I WANT** autocompletion for paths and operations
**SO THAT** I can discover endpoints without leaving the prompt

**ACCEPTANCE:** Tab completion suggests paths from loaded spec

---

## 2. UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ my-api · /users · Bearer ✓ · 200 OK · 142ms                     │  ← StatusLine (1 line)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ > get /users                                                    │  ← Command (user input)
│ ┌─ 200 OK ─ 142ms ─ 1.2KB ─────────────────────────────────────┐│
│ │ [                                                            ││  ← Result (body preview)
│ │   {"id": 1, "name": "Alice"},                                ││
│ │   {"id": 2, "name": "Bob"},                                  ││
│ │   ... (3 more items)                                         ││
│ │ ]                                                            ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ > post /users -b '{"name": "Charlie"}'                          │  ← Command
│ ┌─ 201 Created ─ 89ms ─ 156B ──────────────────────────────────┐│
│ │ {"id": 3, "name": "Charlie", "createdAt": "..."}             ││  ← Result
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ⚠ Warning: Rate limit approaching (80/100)                      │  ← Notice (from header)
│                                                                 │
│                                          [Scrollback Area]      │
├─────────────────────────────────────────────────────────────────┤
│ unireq> _                                                       │  ← CommandLine (input)
│         ├── /users                                              │  ← Autocomplete popup
│         ├── /users/{id}                                         │
│         └── /products                                           │
└─────────────────────────────────────────────────────────────────┘
  [i] inspect  [h] history  [?] help                               ← Hint bar (optional)
```

---

## 3. Component Architecture

### Component Tree

```
<App>
├── <StatusLine />           # Header: workspace · cwd · auth · status · time
├── <Transcript>             # Scrollable event list
│   ├── <TranscriptEvent type="command" />
│   ├── <TranscriptEvent type="result" />
│   ├── <TranscriptEvent type="error" />
│   └── <TranscriptEvent type="notice" />
├── <CommandLine />          # Input with autocomplete
│   └── <AutocompletePopup />
└── <InspectorModal />       # Overlay for [i] inspect (optional)
```

### State Management

```typescript
interface InkAppState {
  // From existing ReplState
  workspace?: string;
  workspaceConfig?: WorkspaceConfig;
  currentPath: string;
  activeProfile?: string;
  spec?: LoadedSpec;

  // New for Ink UI
  transcript: TranscriptEvent[];
  lastResponse?: {
    status: number;
    statusText: string;
    headers: Headers;
    body: string;
    timing: number;
    size: number;
  };
  inputValue: string;
  autocompleteItems: string[];
  autocompleteVisible: boolean;
  selectedAutocompleteIndex: number;

  // Modal states
  inspectorOpen: boolean;
  historyPickerOpen: boolean;
  helpOpen: boolean;
}

interface TranscriptEvent {
  id: string;
  timestamp: Date;
  type: 'command' | 'result' | 'error' | 'notice' | 'meta';
  content: string | ResultContent;
}

interface ResultContent {
  status: number;
  statusText: string;
  timing: number;
  size: number;
  bodyPreview: string;      // Truncated body
  bodyFull: string;         // For inspector
  headers?: Headers;
}
```

---

## 4. Technical Design

### Dependencies

```json
{
  "dependencies": {
    "ink": "^5.1.0",
    "ink-select-input": "^6.0.0",
    "@inkjs/ui": "^2.0.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "ink-testing-library": "^4.0.0"
  }
}
```

### File Structure

```
packages/cli/src/
├── ui/                              # Ink UI module
│   ├── index.tsx                    ✅ render(<App />) + TTYRequiredError
│   ├── App.tsx                      ✅ Root component with state provider
│   ├── components/
│   │   ├── index.ts                 ✅ Component exports
│   │   ├── StatusLine.tsx           ✅ Header: workspace · cwd · auth · status
│   │   ├── Transcript.tsx           ✅ Event list container
│   │   ├── TranscriptEvent.tsx      ✅ Single event (command/result/error/notice)
│   │   ├── CommandLine.tsx          ✅ Input with @inkjs/ui TextInput
│   │   ├── AutocompletePopup.tsx    ✅ Suggestions dropdown
│   │   ├── InspectorModal.tsx       ✅ Full response viewer
│   │   ├── HistoryPicker.tsx        ✅ History selection
│   │   └── HelpPanel.tsx            ✅ Contextual help
│   ├── state/
│   │   ├── index.ts                 ✅ State exports
│   │   ├── types.ts                 ✅ InkAppState, TranscriptEvent types
│   │   ├── reducer.ts               ✅ State reducer
│   │   └── context.tsx              ✅ React context provider
│   ├── hooks/
│   │   ├── index.ts                 ✅ Hook exports
│   │   ├── useKeyBindings.ts        ✅ i, h, ? shortcuts
│   │   ├── useCommand.ts            ✅ Command execution hook
│   │   ├── useAutocomplete.ts       ✅ OpenAPI-aware completion
│   │   └── useExternalEditor.ts     ✅ Ctrl+E editor integration
│   └── utils/
│       ├── index.ts                 ✅ Utility exports
│       ├── capture.ts               ✅ Consola output capture
│       └── notices.ts               ✅ Header notice extraction
├── repl/
│   └── state.ts                     # REPL state types (existing)
└── cli.ts                           # Entry point (to be integrated)
```

### REPL Startup (Ink-only)

```typescript
// cli.ts
async function startRepl() {
  const { runInkRepl } = await import('./ui/index.js');
  await runInkRepl(initialState);
  // TTY check is done inside runInkRepl, throws TTYRequiredError if not TTY
}
```

Note: No fallback engine. Interactive mode requires TTY. Non-TTY usage should use one-shot commands.

### Command Execution Bridge

The existing `CommandRegistry` and `executeRequest()` are preserved. Ink components call them and capture output:

```typescript
// ui/hooks/useCommand.ts
function useCommand() {
  const { state, dispatch } = useAppState();
  const registry = useRef(createDefaultRegistry());

  const executeCommand = useCallback(async (input: string) => {
    // Add command to transcript
    dispatch({ type: 'ADD_TRANSCRIPT', event: {
      type: 'command',
      content: input,
    }});

    // Capture console output
    const capturedOutput = captureOutput(async () => {
      await registry.current.execute(parsed.command, parsed.args, state);
    });

    // Add result to transcript
    dispatch({ type: 'ADD_TRANSCRIPT', event: {
      type: 'result',
      content: capturedOutput,
    }});

    // Update lastResponse if HTTP command
    if (state.lastResponse) {
      dispatch({ type: 'SET_LAST_RESPONSE', response: state.lastResponse });
    }
  }, [state, dispatch]);

  return { executeCommand };
}
```

### Output Capture Adapter

To bridge existing `consola`-based output to Ink:

```typescript
// ui/utils/capture.ts
import { consola } from 'consola';

interface CapturedOutput {
  lines: Array<{ level: 'info' | 'warn' | 'error' | 'success'; text: string }>;
}

async function captureOutput(fn: () => Promise<void>): Promise<CapturedOutput> {
  const lines: CapturedOutput['lines'] = [];

  // Temporarily intercept consola
  const originalReporters = consola.options.reporters;
  consola.options.reporters = [{
    log: (logObj) => {
      lines.push({
        level: logObj.type as any,
        text: logObj.args.join(' '),
      });
    },
  }];

  try {
    await fn();
  } finally {
    consola.options.reporters = originalReporters;
  }

  return { lines };
}
```

---

## 5. Component Specifications

### StatusLine Component

```typescript
// ui/components/StatusLine.tsx
interface StatusLineProps {
  workspace?: string;
  currentPath: string;
  authStatus?: 'none' | 'configured' | 'active';
  lastStatus?: number;
  lastTiming?: number;
}

// Renders: "my-api · /users · Bearer ✓ · 200 OK · 142ms"
```

### Transcript Component

```typescript
// ui/components/Transcript.tsx
interface TranscriptProps {
  events: TranscriptEvent[];
  maxVisible?: number;  // Virtualization for large history
}

// Features:
// - Scroll with arrow keys when focused
// - Auto-scroll to bottom on new events
// - Truncate old events beyond maxHistory
```

### CommandLine Component

```typescript
// ui/components/CommandLine.tsx
interface CommandLineProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  autocompleteItems?: string[];
  prompt?: string;  // "unireq> "
}

// Uses @inkjs/ui TextInput
// Manages autocomplete popup visibility
```

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `i` | Open inspector (last response) | When not typing |
| `h` | Open history picker | When not typing |
| `?` | Show contextual help | When not typing |
| `Ctrl+E` | Open external editor | When in CommandLine |
| `Tab` | Cycle autocomplete | When autocomplete visible |
| `Esc` | Close popup/modal | When modal open |
| `Ctrl+C` | Cancel current / Exit | Always |

---

## 6. Acceptance Criteria (BDD Scenarios)

### S-1: Status line shows current context

```gherkin
Scenario: Status line displays workspace info
  Given workspace "my-api" is active
  And current path is "/users"
  And last request returned 200 in 142ms
  When the UI renders
  Then status line shows "my-api · /users · 200 OK · 142ms"
```

### S-2: Commands appear in transcript

```gherkin
Scenario: User input appears in scrollback
  Given the REPL is running
  When user types "get /users" and presses Enter
  Then transcript shows "> get /users" as command event
  And response appears as result event below
```

### S-3: Errors display distinctly

```gherkin
Scenario: Error response styling
  Given the REPL is running
  When user runs "get /nonexistent"
  And server returns 404
  Then result event shows "404 Not Found" with error styling (red)
```

### S-4: Inspector shows full response

```gherkin
Scenario: Inspect last response
  Given user just ran "get /users"
  And response had headers and 50KB body
  When user presses "i"
  Then inspector modal opens
  And shows full headers
  And shows full body (scrollable)
  When user presses Esc
  Then modal closes
```

### S-5: History picker navigation

```gherkin
Scenario: Browse and rerun history
  Given user has run 5 previous commands
  When user presses "h"
  Then history picker shows recent commands
  When user selects "get /users/1"
  Then that command is inserted into input
```

### S-6: Autocomplete from OpenAPI

```gherkin
Scenario: Path autocomplete
  Given OpenAPI spec is loaded with paths /users, /users/{id}, /products
  And user types "get /u"
  When autocomplete triggers
  Then popup shows "/users" and "/users/{id}"
  When user presses Tab
  Then "/users" is completed in input
```

### S-7: External editor for body

```gherkin
Scenario: Edit body in external editor
  Given $EDITOR is set to "nano"
  When user presses Ctrl+E
  Then nano opens with empty buffer
  When user types JSON and saves
  Then JSON is inserted as -b argument
```

### S-8: TTY requirement for interactive mode

```gherkin
Scenario: Non-TTY environment rejects REPL
  Given stdout is not a TTY (piped or CI)
  When unireq starts in REPL mode
  Then TTYRequiredError is thrown
  And message suggests using one-shot commands
```

### S-9: Transcript truncation

```gherkin
Scenario: Large response body truncated
  Given response body is 100KB JSON
  When result event renders
  Then body preview shows first 20 lines
  And shows "... (truncated, press i to view full)"
```

### S-10: Notice events from headers

```gherkin
Scenario: Rate limit warning extracted
  Given response includes header "X-RateLimit-Remaining: 5"
  And X-RateLimit-Limit is 100
  When result renders
  Then notice event shows "⚠ Rate limit: 5/100 remaining"
```

---

## 7. Implementation Plan

### Phase 1: Foundation ✅ COMPLETE

#### Block 1.1: Project Setup ✅

**Files:**
- `package.json` - Add ink, react, @inkjs/ui dependencies
- `tsconfig.json` - Enable JSX for .tsx files
- `ui/index.tsx` - Entry point
- `ui/App.tsx` - Root component shell

**Deliverables:**
- Ink renders "Hello World"
- Can run with `pnpm tsx src/ui/index.tsx`

**Complexity:** S

#### Block 1.2: State Management ✅

**Files:**
- `ui/state/types.ts` - InkAppState interface
- `ui/state/reducer.ts` - State reducer
- `ui/state/context.tsx` - React context

**Deliverables:**
- State types defined
- Reducer handles ADD_TRANSCRIPT, SET_LAST_RESPONSE
- Context provides state to components

**Complexity:** M

#### Block 1.3: StatusLine Component ✅

**Files:**
- `ui/components/StatusLine.tsx`

**Deliverables:**
- Renders workspace · cwd · status · timing
- Handles missing values gracefully

**Tests:** Component tests with ink-testing-library

**Acceptance criteria covered:** S-1

**Complexity:** S

### Phase 2: Core Components ✅ COMPLETE

#### Block 2.1: Transcript Component ✅

**Files:**
- `ui/components/Transcript.tsx`
- `ui/components/TranscriptEvent.tsx`

**Deliverables:**
- Renders list of events
- Different styling per event type
- Body truncation with preview

**Tests:** Component tests

**Acceptance criteria covered:** S-2, S-3, S-9

**Complexity:** M

#### Block 2.2: CommandLine Component ✅

**Files:**
- `ui/components/CommandLine.tsx`
- `ui/hooks/useCommand.ts` (pending integration)

**Deliverables:**
- TextInput integration
- Submit handler calls registry
- Output capture to transcript

**Tests:** Component + integration tests

**Acceptance criteria covered:** S-2

**Complexity:** M

#### Block 2.3: Output Capture Bridge ✅

**Files:**
- `ui/utils/capture.ts`
- `ui/utils/index.ts`

**Deliverables:**
- Intercept consola output
- Convert to transcript events
- Handle async command execution

**Tests:** Unit tests

**Complexity:** M

### Phase 3: Advanced Features ✅ COMPLETE

#### Block 3.1: Keyboard Shortcuts ✅

**Files:**
- `ui/hooks/useKeyBindings.ts`
- `ui/hooks/index.ts`

**Deliverables:**
- `i`, `h`, `?` handlers
- Focus management (typing vs shortcuts)
- Ctrl+C handling
- Modal state management

**Tests:** 16 tests

**Acceptance criteria covered:** S-4, S-5

**Complexity:** M

#### Block 3.2: Inspector Modal ✅

**Files:**
- `ui/components/InspectorModal.tsx`

**Deliverables:**
- Full response display
- Headers + body tabs (h/b keys)
- Scrollable content (arrows, j/k, PgUp/PgDn)
- Status color coding
- Esc to close

**Tests:** 18 tests

**Acceptance criteria covered:** S-4

**Complexity:** M

#### Block 3.3: History Picker ✅

**Files:**
- `ui/components/HistoryPicker.tsx`

**Deliverables:**
- List recent commands with status/timing
- Arrow keys/j/k navigation
- Enter to select
- Scrolling for long history

**Tests:** 15 tests

**Acceptance criteria covered:** S-5

**Complexity:** M

#### Block 3.4: Autocomplete ✅

**Files:**
- `ui/components/AutocompletePopup.tsx`

**Deliverables:**
- Suggestion list with type-based coloring
- Tab/Enter to select
- Arrow keys/j/k navigation (wrapping)
- Description display
- Max items with "more" indicator

**Tests:** 15 tests

**Acceptance criteria covered:** S-6

**Complexity:** M (reduced from L - useAutocomplete hook deferred to Phase 4)

### Phase 4: Integration ✅ COMPLETE

#### Block 4.1: External Editor

**Files:**
- `ui/hooks/useExternalEditor.ts`

**Deliverables:**
- Spawn $EDITOR process
- Read result on close
- Insert as -b argument

**Tests:** Integration tests (mock editor)

**Acceptance criteria covered:** S-7

**Complexity:** M

#### Block 4.2: TTY Requirement

**Files:**
- `ui/index.tsx` (TTYRequiredError, requireTTY)
- `cli.ts` (modified)

**Deliverables:**
- TTYRequiredError class
- requireTTY() check in runInkRepl
- Clear error message for non-TTY

**Tests:** Unit tests

**Acceptance criteria covered:** S-8

**Complexity:** S (simplified - no fallback)

#### Block 4.3: Notice Extraction

**Files:**
- `ui/utils/notices.ts`

**Deliverables:**
- Extract rate limit headers
- Extract deprecation warnings
- Convert to notice events

**Tests:** Unit tests

**Acceptance criteria covered:** S-10

**Complexity:** S

---

## 8. Test Strategy

### Component Testing

Use `ink-testing-library` for isolated component tests:

```typescript
import { render } from 'ink-testing-library';
import { StatusLine } from './StatusLine';

test('renders workspace and path', () => {
  const { lastFrame } = render(
    <StatusLine workspace="my-api" currentPath="/users" />
  );

  expect(lastFrame()).toContain('my-api');
  expect(lastFrame()).toContain('/users');
});
```

### Integration Testing

Test full App with mocked command execution:

```typescript
test('command appears in transcript', async () => {
  const { stdin, lastFrame } = render(<App initialState={mockState} />);

  await stdin.write('get /users\n');

  expect(lastFrame()).toContain('> get /users');
});
```

### E2E Testing

Extend existing CLI E2E tests for Ink mode:

```typescript
test('ink repl shows status line', async () => {
  const { stdout } = await runCli(['repl'], {
    input: 'exit\n',
    env: { TERM: 'xterm-256color' },
  });

  expect(stdout).toContain('unireq>');
});
```

### Test Matrix

| Scenario | Component | Integration | E2E | Status |
|----------|-----------|-------------|-----|--------|
| S-1: Status line | ✅ 11 tests | - | - | DONE |
| S-2: Transcript | ✅ 16 tests | - | - | DONE |
| S-3: Error styling | ✅ in TranscriptEvent | - | - | DONE |
| S-4: Inspector | ✅ 18 tests | Pending | - | DONE |
| S-5: History picker | ✅ 15 tests | Pending | - | DONE |
| S-6: Autocomplete | ✅ 15 tests | Pending | - | DONE |
| S-7: External editor | ✅ 14 tests | - | - | DONE |
| S-8: TTY requirement | ✅ 5 tests | - | - | DONE |
| S-9: Truncation | ✅ in TranscriptEvent | - | - | DONE |
| S-10: Notices | ✅ 21 tests | - | - | DONE |

**Current test counts:** 242 UI tests (19 test files)

---

## 9. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Ink terminal compatibility | Low | Medium | TTY check + clear error message |
| Performance with large transcript | Medium | Medium | Virtualization, max history |
| Complex keyboard handling | High | Medium | Use @inkjs/ui, thorough testing |
| React bundle size | Low | Low | Tree-shaking, production build |
| External editor on Windows | Medium | Low | Detect and warn, fallback to inline |

---

## 10. Migration Strategy

### Ink-Only Approach (Implemented)

- Interactive mode requires TTY (throws `TTYRequiredError` if not)
- No fallback to readline - simplifies codebase
- Non-TTY usage should use one-shot commands (e.g., `unireq get /users`)
- Document in README

### Phase A: Initial Release

- Basic UI with StatusLine, Transcript, CommandLine
- TTY check on startup
- Add missing features
- Improve performance

### Phase C: Legacy Deprecation (Future)

- Warn when using legacy REPL
- Eventually remove (major version)

---

## Definition of Done

- [ ] Ink dependencies added
- [ ] All 10 components implemented
- [ ] Keyboard shortcuts working (i, h, ?, Ctrl+E)
- [ ] Output capture bridge functional
- [ ] Fallback to legacy REPL working
- [ ] All 10 BDD scenarios have passing tests
- [ ] Lint/typecheck pass
- [ ] Performance acceptable (60fps rendering)
- [ ] TODO_CLI_CORE.md updated
- [ ] README updated with new UI documentation
