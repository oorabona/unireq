---
doc-meta:
  status: draft
  scope: cli-core
  type: specification
  created: 2026-01-02
  updated: 2026-01-02
---

# Specification: Unified HTTP Options (DRY CLI/REPL)

## 1. User Stories

### US-1: Consistent Options
AS A CLI user,
I WANT the same options in REPL mode as in one-shot mode,
SO THAT I have a predictable experience.

ACCEPTANCE: `get /users -i -S --trace` works identically in both modes.

### US-2: Command Help
AS A CLI user,
I WANT to type `help <command>` in REPL,
SO THAT I can see available options for a specific command.

ACCEPTANCE: `help get` shows GET command options with descriptions.

## 2. Business Rules

### Invariants
- All HTTP commands (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) share the same options
- Option parsing is case-insensitive for long flags (--Header vs --header)
- Short flags are case-sensitive (-H vs -h)

### Options Definition

| Short | Long | Type | Default | Description |
|-------|------|------|---------|-------------|
| `-H` | `--header` | string[] | [] | Add header (key:value) |
| `-q` | `--query` | string[] | [] | Add query param (key=value) |
| `-b` | `--body` | string | - | Request body (JSON or @file) |
| `-t` | `--timeout` | number | - | Request timeout in ms |
| `-o` | `--output` | string | pretty | Output mode: pretty, json, raw |
| `-i` | `--include` | boolean | false | Include response headers |
| | `--no-redact` | boolean | false | Disable secret redaction |
| `-S` | `--summary` | boolean | false | Show summary footer |
| | `--trace` | boolean | false | Show timing info |
| `-e` | `--export` | string | - | Export as: curl, httpie |

### Error Handling
- Unknown flag: Error with suggestion to use `help <cmd>`
- Missing required value: Error with expected format
- Invalid JSON body: Error with parse message

## 3. Technical Impact

### New Module: `src/shared/http-options.ts`

```typescript
export interface HttpRequestOptions {
  headers: string[];
  query: string[];
  body?: string;
  timeout?: number;
  outputMode?: OutputMode;
  includeHeaders?: boolean;
  showSecrets?: boolean;
  showSummary?: boolean;
  trace?: boolean;
  exportFormat?: ExportFormat;
}

export const HTTP_OPTIONS: OptionDefinition[] = [
  { short: 'H', long: 'header', type: 'string', multiple: true, description: '...' },
  // ... all options
];

export function parseHttpOptions(args: string[]): { url: string; options: HttpRequestOptions };
```

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/http-options.ts` | NEW - shared options definition + parser |
| `src/repl/http-parser.ts` | Use shared parser |
| `src/repl/http-commands.ts` | Pass all options to executeRequest |
| `src/repl/commands.ts` | Add `help <command>` handler |
| `src/commands/shortcuts.ts` | Use shared options (keep citty for CLI) |

## 4. Acceptance Criteria (BDD)

### Scenario 1: REPL with -i flag
```gherkin
Scenario: Include headers in REPL output
  Given REPL is running
  When user executes "get /users -i"
  Then response headers are displayed
  And response body is displayed
```

### Scenario 2: REPL with -S flag
```gherkin
Scenario: Show summary footer in REPL
  Given REPL is running
  When user executes "get /users -S"
  Then summary footer "── 200 OK · X bytes ──" is displayed
```

### Scenario 3: REPL with -o json
```gherkin
Scenario: JSON output mode in REPL
  Given REPL is running
  When user executes "get /users -o json"
  Then output is valid JSON with status, headers, body
```

### Scenario 4: Help for specific command
```gherkin
Scenario: Help for GET command
  Given REPL is running
  When user executes "help get"
  Then GET command description is shown
  And all available options are listed with descriptions
```

### Scenario 5: General help unchanged
```gherkin
Scenario: General help command
  Given REPL is running
  When user executes "help"
  Then list of all commands is shown
```

### Scenario 6: Unknown flag error
```gherkin
Scenario: Unknown flag handling
  Given REPL is running
  When user executes "get /users --unknown"
  Then error "Unknown flag: --unknown" is shown
```

## 5. Implementation Plan

### Block 1: Shared Options Module (Vertical Slice)
**Packages:** cli

- **Module:** `src/shared/http-options.ts`
  - Option definitions with metadata
  - `parseHttpOptions()` function
  - Type exports
- **Tests:** `src/__tests__/http-options.test.ts`
  - Parse simple flags
  - Parse with values
  - Multiple values for repeatable flags
  - Unknown flag error
  - Missing value error

**Complexity:** M
**Dependencies:** None

### Block 2: REPL Integration (Vertical Slice)
**Packages:** cli

- **Modify:** `src/repl/http-parser.ts`
  - Use `parseHttpOptions()` instead of manual parsing
- **Modify:** `src/repl/http-commands.ts`
  - Pass options to `executeRequest()`
- **Tests:** Update existing + add new

**Complexity:** M
**Dependencies:** Block 1

### Block 3: Help Command Enhancement (Vertical Slice)
**Packages:** cli

- **Modify:** `src/repl/commands.ts`
  - `help` handler checks for args[0] (command name)
  - If command specified, show detailed help
  - Add `helpText` to Command interface
- **Add:** Help text generation from option definitions
- **Tests:** Help command tests

**Complexity:** S
**Dependencies:** Block 1

## 6. Test Strategy

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Option parsing | Yes | - | - |
| REPL with -i | - | Yes | Yes |
| REPL with -S | - | Yes | Yes |
| REPL with -o | - | Yes | Yes |
| help <cmd> | Yes | - | Yes |
| Unknown flag | Yes | - | - |

---

## Definition of Done

- [ ] All blocks implemented
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass
- [ ] Lint/typecheck pass
- [ ] Documentation updated
