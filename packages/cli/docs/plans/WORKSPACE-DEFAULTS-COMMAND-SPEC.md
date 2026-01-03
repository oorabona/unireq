---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2026-01-03
  updated: 2026-01-03
  implemented: 2026-01-03
---

# Specification: Defaults Command (REPL + CLI)

## 1. User Stories

### US-1: View Current Defaults with Source Tracking

**AS A** developer using unireq
**I WANT** to see all my current HTTP output defaults with their sources
**SO THAT** I understand why a particular flag is being applied

**ACCEPTANCE:** `defaults` command shows all keys, values, and sources (built-in, workspace, profile, session)

### US-2: Inspect Single Default

**AS A** developer debugging default behavior
**I WANT** to query a single default key
**SO THAT** I can quickly check its value and origin

**ACCEPTANCE:** `defaults get <key>` shows value and full source chain

### US-3: Session Override

**AS A** developer who needs temporary different settings
**I WANT** to override a default for my current REPL session
**SO THAT** I can experiment without modifying workspace.yaml

**ACCEPTANCE:** `defaults set <key> <value>` stores in session and affects subsequent requests

### US-4: Reset Session Override

**AS A** developer who wants to revert to config values
**I WANT** to clear my session overrides
**SO THAT** I return to the workspace/profile configured behavior

**ACCEPTANCE:** `defaults reset [<key>]` clears one or all session overrides

---

## 2. Business Rules

### Supported Keys

Only HTTP output defaults are manageable (from `HttpOutputDefaults`):

| Key | Type | Valid Values | Default |
|-----|------|--------------|---------|
| `includeHeaders` | boolean | true, false | false |
| `outputMode` | enum | pretty, json, raw | pretty |
| `showSummary` | boolean | true, false | false |
| `trace` | boolean | true, false | false |
| `showSecrets` | boolean | true, false | false |
| `hideBody` | boolean | true, false | false |

### Priority Order (Extended)

```
CLI flags (explicit)
    ↓
session defaults (ephemeral REPL override)      # NEW
    ↓
profile.defaults.{method}
    ↓
profile.defaults
    ↓
workspace.defaults.{method}
    ↓
workspace.defaults
    ↓
Built-in defaults
```

### Source Labels

| Source | Label | Description |
|--------|-------|-------------|
| Built-in | `built-in` | Hardcoded defaults in code |
| Workspace general | `workspace` | `workspace.yaml → defaults.{key}` |
| Workspace method | `workspace.{method}` | `workspace.yaml → defaults.{method}.{key}` |
| Profile general | `profile:{name}` | `workspace.yaml → profiles.{name}.defaults.{key}` |
| Profile method | `profile:{name}.{method}` | `workspace.yaml → profiles.{name}.defaults.{method}.{key}` |
| Session | `session` | REPL session override |

### Invariants

- Session overrides are global (not method-specific) - keeps UX simple
- Session overrides are ephemeral (lost on REPL exit)
- `defaults set` is REPL-only (CLI one-shot has no session)
- Source tracking always shows the winning source, not the full chain
- Unknown keys produce helpful error with suggestions

---

## 3. Technical Design

### ReplState Extension

```typescript
// repl/state.ts

export interface ReplState {
  // ... existing fields ...

  /** Session-level HTTP output default overrides (ephemeral) */
  sessionDefaults?: HttpOutputDefaults;
}
```

### Source Tracking Types

```typescript
// workspace/defaults/types.ts

export type DefaultSource =
  | 'built-in'
  | 'workspace'
  | `workspace.${HttpMethodName}`
  | `profile:${string}`
  | `profile:${string}.${HttpMethodName}`
  | 'session';

export interface ResolvedDefault<T = unknown> {
  key: string;
  value: T;
  source: DefaultSource;
}

export interface ResolvedDefaults {
  includeHeaders: ResolvedDefault<boolean>;
  outputMode: ResolvedDefault<'pretty' | 'json' | 'raw'>;
  showSummary: ResolvedDefault<boolean>;
  trace: ResolvedDefault<boolean>;
  showSecrets: ResolvedDefault<boolean>;
  hideBody: ResolvedDefault<boolean>;
}
```

### Source Tracker Function

```typescript
// workspace/defaults/source-tracker.ts

import type { HttpDefaults, HttpMethodName, HttpOutputDefaults } from '../config/types.js';

/**
 * Built-in defaults (matches HTTP_OPTIONS in http-options.ts)
 */
export const BUILT_IN_DEFAULTS: Required<HttpOutputDefaults> = {
  includeHeaders: false,
  outputMode: 'pretty',
  showSummary: false,
  trace: false,
  showSecrets: false,
  hideBody: false,
};

/**
 * Resolve HTTP defaults with source tracking
 * Returns each key with its effective value and source
 */
export function resolveDefaultsWithSource(
  method: HttpMethodName | undefined,
  workspaceDefaults?: HttpDefaults,
  profileDefaults?: HttpDefaults,
  profileName?: string,
  sessionDefaults?: HttpOutputDefaults
): ResolvedDefaults {
  // Start with built-in
  const resolved: ResolvedDefaults = {
    includeHeaders: { key: 'includeHeaders', value: BUILT_IN_DEFAULTS.includeHeaders, source: 'built-in' },
    outputMode: { key: 'outputMode', value: BUILT_IN_DEFAULTS.outputMode, source: 'built-in' },
    showSummary: { key: 'showSummary', value: BUILT_IN_DEFAULTS.showSummary, source: 'built-in' },
    trace: { key: 'trace', value: BUILT_IN_DEFAULTS.trace, source: 'built-in' },
    showSecrets: { key: 'showSecrets', value: BUILT_IN_DEFAULTS.showSecrets, source: 'built-in' },
    hideBody: { key: 'hideBody', value: BUILT_IN_DEFAULTS.hideBody, source: 'built-in' },
  };

  // Layer 1: Workspace general
  applyWithSource(resolved, workspaceDefaults, 'workspace');

  // Layer 2: Workspace method-specific
  if (method && workspaceDefaults?.[method]) {
    applyWithSource(resolved, workspaceDefaults[method], `workspace.${method}`);
  }

  // Layer 3: Profile general
  if (profileDefaults && profileName) {
    applyWithSource(resolved, profileDefaults, `profile:${profileName}`);
  }

  // Layer 4: Profile method-specific
  if (method && profileDefaults?.[method] && profileName) {
    applyWithSource(resolved, profileDefaults[method], `profile:${profileName}.${method}`);
  }

  // Layer 5: Session overrides (highest priority)
  if (sessionDefaults) {
    applyWithSource(resolved, sessionDefaults, 'session');
  }

  return resolved;
}
```

### Modified resolveHttpDefaults

```typescript
// shared/http-options.ts

export function resolveHttpDefaults(
  method: HttpMethodName,
  workspaceDefaults?: HttpDefaults,
  profileDefaults?: HttpDefaults,
  sessionDefaults?: HttpOutputDefaults  // NEW parameter
): Partial<ParsedHttpOptions> {
  // ... existing logic ...

  // Layer 5: Session overrides (NEW - highest priority)
  if (sessionDefaults) {
    applyOutputDefaults(resolved, sessionDefaults);
  }

  return resolved;
}
```

### Command Handlers

```typescript
// workspace/defaults/commands.ts

export const defaultsHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand) {
    return showAllDefaults(state);
  }

  switch (subcommand) {
    case 'get':
      return getDefault(args.slice(1), state);
    case 'set':
      return setDefault(args.slice(1), state);
    case 'reset':
      return resetDefault(args.slice(1), state);
    default:
      // Treat as key name for get
      return getDefault(args, state);
  }
};
```

---

## 4. Technical Impact

| Layer | File | Changes |
|-------|------|---------|
| Types | `workspace/defaults/types.ts` | New: `DefaultSource`, `ResolvedDefault`, `ResolvedDefaults` |
| State | `repl/state.ts` | Add `sessionDefaults?: HttpOutputDefaults` |
| Tracker | `workspace/defaults/source-tracker.ts` | New: `resolveDefaultsWithSource()`, `BUILT_IN_DEFAULTS` |
| Options | `shared/http-options.ts` | Add `sessionDefaults` parameter to `resolveHttpDefaults()` |
| REPL | `workspace/defaults/commands.ts` | New: `defaultsHandler`, `showAllDefaults`, `getDefault`, `setDefault`, `resetDefault` |
| CLI | `commands/defaults.ts` | New: CLI command for `unireq defaults` |
| Registry | `repl/commands.ts` | Register `defaults` command |
| Help | `repl/help.ts` | Add command metadata |

---

## 5. Acceptance Criteria (BDD Scenarios)

### S-1: Show all defaults with sources

```gherkin
Scenario: Display all defaults with source tracking
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
    profiles:
      dev:
        baseUrl: http://localhost
        defaults:
          trace: true
    """
  And profile "dev" is active
  When user runs "defaults"
  Then output shows:
    | Key | Value | Source |
    | includeHeaders | true | workspace |
    | outputMode | pretty | built-in |
    | showSummary | false | built-in |
    | trace | true | profile:dev |
    | showSecrets | false | built-in |
    | hideBody | false | built-in |
```

### S-2: Get single default

```gherkin
Scenario: Get specific default key
  Given workspace.yaml contains defaults.includeHeaders: true
  When user runs "defaults get includeHeaders"
  Then output shows "includeHeaders = true (source: workspace)"
```

### S-3: Get unknown key error

```gherkin
Scenario: Get unknown key with suggestion
  When user runs "defaults get inclueHeaders"
  Then output shows error "Unknown key: inclueHeaders"
  And suggests "Did you mean: includeHeaders?"
```

### S-4: Set session override (boolean)

```gherkin
Scenario: Set boolean session override
  Given workspace.yaml contains defaults.includeHeaders: true
  When user runs "defaults set includeHeaders false"
  Then session override is stored
  And output shows "Set includeHeaders = false (session override)"
  When user runs "defaults get includeHeaders"
  Then output shows "includeHeaders = false (source: session)"
```

### S-5: Set session override (enum)

```gherkin
Scenario: Set enum session override
  When user runs "defaults set outputMode json"
  Then session override is stored
  And output shows "Set outputMode = json (session override)"
```

### S-6: Set invalid enum value

```gherkin
Scenario: Invalid enum value rejected
  When user runs "defaults set outputMode yaml"
  Then output shows error "Invalid value 'yaml' for outputMode"
  And suggests "Valid values: pretty, json, raw"
```

### S-7: Reset single override

```gherkin
Scenario: Reset specific session override
  Given session override includeHeaders = false
  And workspace.yaml contains defaults.includeHeaders: true
  When user runs "defaults reset includeHeaders"
  Then session override is removed
  And output shows "Reset includeHeaders (now: true from workspace)"
```

### S-8: Reset all overrides

```gherkin
Scenario: Reset all session overrides
  Given session overrides exist for includeHeaders and trace
  When user runs "defaults reset"
  Then all session overrides are cleared
  And output shows "Cleared 2 session overrides"
```

### S-9: Reset non-existent override

```gherkin
Scenario: Reset when no override exists
  Given no session override for includeHeaders
  When user runs "defaults reset includeHeaders"
  Then output shows info "No session override for includeHeaders"
```

### S-10: Session override affects HTTP commands

```gherkin
Scenario: Session defaults used in HTTP requests
  Given workspace.yaml contains defaults.includeHeaders: false
  And user runs "defaults set includeHeaders true"
  When user runs "get /users"
  Then response includes headers (session override applied)
```

### S-11: CLI defaults command (view only)

```gherkin
Scenario: CLI view defaults
  Given workspace.yaml contains defaults.includeHeaders: true
  When user runs "unireq defaults" from shell
  Then output shows same table as REPL defaults command
```

### S-12: CLI defaults get

```gherkin
Scenario: CLI get specific default
  Given workspace.yaml contains defaults.trace: true
  When user runs "unireq defaults get trace" from shell
  Then output shows "trace = true (source: workspace)"
```

### S-13: CLI set rejected

```gherkin
Scenario: CLI set not supported
  When user runs "unireq defaults set includeHeaders true" from shell
  Then output shows error "Session overrides only available in REPL mode"
  And suggests "Use 'unireq' to start REPL, then 'defaults set'"
```

### S-14: No workspace shows built-in only

```gherkin
Scenario: Defaults without workspace
  Given no workspace is loaded
  When user runs "defaults"
  Then output shows all keys with source "built-in"
```

### S-15: Method-specific source tracking

```gherkin
Scenario: Method-specific defaults show in source
  Given workspace.yaml contains:
    """
    defaults:
      get:
        includeHeaders: true
    """
  When user runs "defaults" with current method context as GET
  Then includeHeaders shows source "workspace.get"
```

---

## 6. Implementation Plan

### Block 1: Types and Source Tracker

**Files:**
- `workspace/defaults/types.ts` (new)
- `workspace/defaults/source-tracker.ts` (new)
- `workspace/defaults/index.ts` (new)

**Deliverables:**
- `DefaultSource` type union
- `ResolvedDefault<T>` interface
- `ResolvedDefaults` interface
- `BUILT_IN_DEFAULTS` constant
- `resolveDefaultsWithSource()` function

**Tests:** Unit tests for source tracking

**Complexity:** S

### Block 2: State Extension

**Files:**
- `repl/state.ts` (modified)
- `shared/http-options.ts` (modified)
- `repl/http-commands.ts` (modified)

**Deliverables:**
- Add `sessionDefaults?: HttpOutputDefaults` to ReplState
- Add `sessionDefaults` parameter to `resolveHttpDefaults()`
- Pass sessionDefaults from state to resolver

**Tests:** Unit tests for priority

**Complexity:** S

### Block 3: REPL Command

**Files:**
- `workspace/defaults/commands.ts` (new)
- `repl/commands.ts` (modified)
- `repl/help.ts` (modified)

**Deliverables:**
- `defaultsHandler` with subcommands
- `showAllDefaults()` - formatted table output
- `getDefault()` - single key lookup
- `setDefault()` - session override
- `resetDefault()` - clear overrides
- Command registration

**Tests:** Unit tests for all subcommands

**Complexity:** M

### Block 4: CLI Command

**Files:**
- `commands/defaults.ts` (new)
- `commands/index.ts` (modified)

**Deliverables:**
- CLI command: `unireq defaults [get <key>]`
- Error for `set`/`reset` in CLI mode

**Tests:** E2E tests

**Complexity:** S

---

## 7. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| S-1: Show all | Yes | - | - |
| S-2: Get single | Yes | - | - |
| S-3: Unknown key | Yes | - | - |
| S-4: Set boolean | Yes | - | - |
| S-5: Set enum | Yes | - | - |
| S-6: Invalid enum | Yes | - | - |
| S-7: Reset single | Yes | - | - |
| S-8: Reset all | Yes | - | - |
| S-9: Reset none | Yes | - | - |
| S-10: Affects HTTP | - | Yes | - |
| S-11: CLI view | - | - | Yes |
| S-12: CLI get | - | - | Yes |
| S-13: CLI set error | - | - | Yes |
| S-14: No workspace | Yes | - | - |
| S-15: Method source | Yes | - | - |

### Test Files

- `workspace/defaults/__tests__/source-tracker.test.ts` - Source tracking unit tests
- `workspace/defaults/__tests__/commands.test.ts` - REPL command tests
- `__tests__/cli.e2e.test.ts` - CLI integration (existing, extend)

---

## 8. Output Format Examples

### `defaults` (view all)

```
HTTP Output Defaults:
┌─────────────────┬─────────┬───────────────┐
│ Key             │ Value   │ Source        │
├─────────────────┼─────────┼───────────────┤
│ includeHeaders  │ true    │ workspace     │
│ outputMode      │ pretty  │ built-in      │
│ showSummary     │ false   │ built-in      │
│ trace           │ true    │ profile:dev   │
│ showSecrets     │ false   │ built-in      │
│ hideBody        │ false   │ built-in      │
└─────────────────┴─────────┴───────────────┘

Session overrides: 0
```

### `defaults get <key>`

```
includeHeaders = true
  Source: workspace
  Config: workspace.yaml → defaults.includeHeaders
```

### `defaults set <key> <value>`

```
✓ Set includeHeaders = false (session override)
```

### `defaults reset`

```
✓ Cleared 2 session overrides:
  - includeHeaders (now: true from workspace)
  - trace (now: false from built-in)
```

---

## Definition of Done

- [ ] `DefaultSource` and `ResolvedDefault` types defined
- [ ] `BUILT_IN_DEFAULTS` constant exported
- [ ] `resolveDefaultsWithSource()` function implemented
- [ ] `sessionDefaults` added to `ReplState`
- [ ] `resolveHttpDefaults()` accepts session parameter
- [ ] HTTP commands pass sessionDefaults to resolver
- [ ] REPL `defaults` command with get/set/reset
- [ ] CLI `unireq defaults` command (view + get only)
- [ ] All 15 BDD scenarios have passing tests
- [ ] Help text updated
- [ ] Lint/typecheck pass
- [ ] TODO_WORKSPACE.md updated
