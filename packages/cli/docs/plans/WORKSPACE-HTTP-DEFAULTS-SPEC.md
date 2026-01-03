---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2026-01-03
  updated: 2026-01-03
  implemented: 2026-01-03
---

# Specification: HTTP Command Defaults at Workspace/Profile Level

## 1. User Stories

### US-1: Workspace-Level HTTP Defaults

**AS A** developer working with an API that requires specific output settings
**I WANT** to configure HTTP command defaults at the workspace level
**SO THAT** I don't have to repeat flags like `-i` (include headers) on every command

**ACCEPTANCE:** `workspace.yaml` accepts a `defaults` section that applies to all HTTP commands

### US-2: Profile-Level HTTP Defaults Override

**AS A** developer with different output needs per environment
**I WANT** profile-specific defaults that override workspace defaults
**SO THAT** I can have `-i` always on in dev but not in prod

**ACCEPTANCE:** Profile `defaults` section overrides workspace `defaults`

### US-3: CLI Flags Override All Defaults

**AS A** developer who occasionally needs different output
**I WANT** CLI flags to always take precedence over configured defaults
**SO THAT** I maintain full control when needed (explicit > implicit)

**ACCEPTANCE:** `get /users --no-body` overrides `defaults.hideBody: false`

### US-4: Method-Specific Defaults

**AS A** developer with different output needs per HTTP method
**I WANT** to configure defaults specific to GET, POST, DELETE, etc.
**SO THAT** GET requests show headers but POST requests show timing

**ACCEPTANCE:** `defaults.get.includeHeaders: true` applies only to GET commands

---

## 2. Business Rules

### Defaults Scope

Defaults apply ONLY to boolean/enum HTTP options that affect output presentation:

| Option | Flag | Defaultable | Rationale |
|--------|------|-------------|-----------|
| `includeHeaders` | `-i` | Yes | Output presentation |
| `outputMode` | `-o` | Yes | Output presentation |
| `showSummary` | `-S` | Yes | Output presentation |
| `trace` | `--trace` | Yes | Output presentation |
| `showSecrets` | `--no-redact` | Yes | Output presentation |
| `hideBody` | `-B` | Yes | Output presentation |
| `headers` | `-H` | **No** | Request modification |
| `query` | `-q` | **No** | Request modification |
| `body` | `-b` | **No** | Request modification |
| `timeout` | `-t` | **No** | Use profile.timeoutMs instead |
| `exportFormat` | `-e` | **No** | One-time action |

### Typical Method-Specific Use Cases

| Method | Typical Defaults | Rationale |
|--------|------------------|-----------|
| `GET` | `includeHeaders: true` | See Cache-Control, ETag, Content-Type |
| `POST/PUT/PATCH` | `trace: true` | Timing important for mutations |
| `DELETE` | `showSummary: true` | Concise confirmation |
| `HEAD` | (implicit headers) | HEAD = headers only by nature |

### Priority Order (Highest to Lowest)

```
CLI flags (explicit)
    ↓
profile.defaults.{method}    # e.g., profile.defaults.get
    ↓
profile.defaults             # General profile defaults
    ↓
workspace.defaults.{method}  # e.g., workspace.defaults.get
    ↓
workspace.defaults           # General workspace defaults
    ↓
Built-in defaults (HTTP_OPTIONS)
```

### Merge Strategy

- Boolean fields: later value replaces earlier
- Enum fields (outputMode): later value replaces earlier
- Method-specific defaults override general defaults at same level
- Defaults are merged at command parse time, not config load time

### Invariants

- Defaults MUST NOT change request semantics (no headers, query, body)
- Defaults MUST be optional (missing = use built-in defaults)
- Unknown default fields MUST be ignored with warning
- Empty `defaults: {}` is valid (no-op)
- Method-specific defaults MUST NOT nest (no `defaults.get.post`)

---

## 3. Technical Design

### Schema Extension

```typescript
// workspace/config/types.ts

/**
 * HTTP methods that support method-specific defaults
 */
export type HttpMethodName = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * Base HTTP output defaults (no method nesting)
 */
export interface HttpOutputDefaults {
  /** Include response headers in output (-i) */
  includeHeaders?: boolean;
  /** Output mode: pretty, json, raw (-o) */
  outputMode?: 'pretty' | 'json' | 'raw';
  /** Show summary footer with status and size (-S) */
  showSummary?: boolean;
  /** Show timing information (--trace) */
  trace?: boolean;
  /** Disable secret redaction (--no-redact) */
  showSecrets?: boolean;
  /** Hide response body (-B) */
  hideBody?: boolean;
}

/**
 * HTTP command defaults with optional method-specific overrides
 */
export interface HttpDefaults extends HttpOutputDefaults {
  /** GET-specific defaults */
  get?: HttpOutputDefaults;
  /** POST-specific defaults */
  post?: HttpOutputDefaults;
  /** PUT-specific defaults */
  put?: HttpOutputDefaults;
  /** PATCH-specific defaults */
  patch?: HttpOutputDefaults;
  /** DELETE-specific defaults */
  delete?: HttpOutputDefaults;
  /** HEAD-specific defaults */
  head?: HttpOutputDefaults;
  /** OPTIONS-specific defaults */
  options?: HttpOutputDefaults;
}

// Add to ProfileConfig
export interface ProfileConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  verifyTls?: boolean;
  vars?: Record<string, string>;
  secrets?: Record<string, string>;
  defaults?: HttpDefaults;  // NEW
}

// Add to WorkspaceConfig
export interface WorkspaceConfig {
  version: 2;
  name: string;
  // ... existing fields ...
  defaults?: HttpDefaults;  // NEW
}
```

### Defaults Resolution Function

```typescript
// shared/http-options.ts

import type { HttpDefaults, HttpMethodName, HttpOutputDefaults } from '../workspace/config/types.js';

/**
 * Resolve HTTP defaults from workspace and profile configuration
 * @param method - HTTP method (get, post, etc.)
 * @param workspaceDefaults - Workspace-level defaults
 * @param profileDefaults - Profile-level defaults (overrides workspace)
 * @returns Resolved defaults for the specific method
 */
export function resolveHttpDefaults(
  method: HttpMethodName,
  workspaceDefaults?: HttpDefaults,
  profileDefaults?: HttpDefaults
): Partial<ParsedHttpOptions> {
  const resolved: Partial<ParsedHttpOptions> = {};

  // Layer 1: Workspace general defaults
  if (workspaceDefaults) {
    applyOutputDefaults(resolved, workspaceDefaults);
  }

  // Layer 2: Workspace method-specific defaults
  if (workspaceDefaults?.[method]) {
    applyOutputDefaults(resolved, workspaceDefaults[method]);
  }

  // Layer 3: Profile general defaults
  if (profileDefaults) {
    applyOutputDefaults(resolved, profileDefaults);
  }

  // Layer 4: Profile method-specific defaults
  if (profileDefaults?.[method]) {
    applyOutputDefaults(resolved, profileDefaults[method]);
  }

  return resolved;
}

/**
 * Apply output defaults to target options
 */
function applyOutputDefaults(
  target: Partial<ParsedHttpOptions>,
  source: HttpOutputDefaults
): void {
  if (source.includeHeaders !== undefined) {
    target.includeHeaders = source.includeHeaders;
  }
  if (source.outputMode !== undefined) {
    target.outputMode = source.outputMode;
  }
  if (source.showSummary !== undefined) {
    target.showSummary = source.showSummary;
  }
  if (source.trace !== undefined) {
    target.trace = source.trace;
  }
  if (source.showSecrets !== undefined) {
    target.showSecrets = source.showSecrets;
  }
  if (source.hideBody !== undefined) {
    target.hideBody = source.hideBody;
  }
}
```

### Modified parseHttpOptions Signature

```typescript
// shared/http-options.ts

/**
 * Parse command arguments into HTTP options
 * @param args - Command arguments (after URL)
 * @param defaults - Pre-resolved defaults from config
 * @returns Parsed options with defaults applied
 */
export function parseHttpOptions(
  args: string[],
  defaults?: Partial<ParsedHttpOptions>
): ParsedHttpOptions {
  // Start with defaults, then override with CLI args
  const options: ParsedHttpOptions = {
    headers: [],
    query: [],
    ...defaults,  // Apply defaults
  };

  // ... existing parsing logic (CLI args override defaults) ...
}
```

### HTTP Command Handler Integration

```typescript
// repl/http-commands.ts

export function createHttpHandler(method: HttpMethod): CommandHandler {
  return async (args: string[], state: ReplState) => {
    // Resolve defaults for this specific method
    const defaults = resolveHttpDefaults(
      method.toLowerCase() as HttpMethodName,
      state.workspaceConfig?.defaults,
      state.workspaceConfig?.profiles?.[state.activeProfile ?? '']?.defaults
    );

    // Parse with defaults
    const parsed = parseHttpCommand(method, args, defaults);

    // ... rest of execution
  };
}
```

---

## 4. Technical Impact

| Layer | File | Changes |
|-------|------|---------|
| Types | `workspace/config/types.ts` | Add `HttpDefaults`, `HttpOutputDefaults`, `HttpMethodName` |
| Schema | `workspace/config/schema.ts` | Add Valibot schema for defaults + method-specific |
| Options | `shared/http-options.ts` | Add `resolveHttpDefaults()`, modify `parseHttpOptions()` |
| Commands | `repl/http-commands.ts` | Pass method + resolved defaults to parser |
| Shell | `commands/shortcuts.ts` | Pass method + resolved defaults to parser |
| Tests | `shared/__tests__/http-options.test.ts` | Add defaults + method-specific tests |
| Tests | `workspace/config/__tests__/schema.test.ts` | Add defaults validation tests |

---

## 5. Acceptance Criteria (BDD Scenarios)

### S-1: Workspace defaults apply to all commands

```gherkin
Scenario: Workspace-level includeHeaders default
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
    """
  And no profile is active
  When user runs "get /users" (without -i flag)
  Then response headers are included in output
  When user runs "post /users -b '{}'"
  Then response headers are also included
```

### S-2: Profile defaults override workspace defaults

```gherkin
Scenario: Profile overrides workspace default
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
      showSummary: true
    profiles:
      prod:
        baseUrl: https://api.example.com
        defaults:
          includeHeaders: false
    """
  And profile "prod" is active
  When user runs "get /users"
  Then response headers are NOT included (profile override)
  And summary footer IS shown (inherited from workspace)
```

### S-3: CLI flag overrides all defaults

```gherkin
Scenario: Explicit CLI flag takes precedence
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
    """
  When user runs "get /users" (no flag)
  Then headers are included
  When user runs "get /users -B" (explicit hide body)
  Then body is hidden despite no hideBody default
```

### S-4: Missing defaults uses built-in values

```gherkin
Scenario: No defaults configured
  Given workspace.yaml contains only:
    """
    version: 2
    name: my-api
    """
  When user runs "get /users"
  Then built-in defaults apply (includeHeaders: false, etc.)
```

### S-5: Empty defaults object is valid

```gherkin
Scenario: Empty defaults section
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults: {}
    """
  When loadWorkspaceConfig() is called
  Then it succeeds with empty defaults
```

### S-6: Unknown default fields logged as warning

```gherkin
Scenario: Forward compatibility with unknown defaults
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
      futureOption: true
    """
  When loadWorkspaceConfig() is called
  Then it succeeds
  And "futureOption" is ignored
  And a warning is logged about unknown field
```

### S-7: Invalid default value rejected

```gherkin
Scenario: Wrong type for default
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      outputMode: "invalid-mode"
    """
  When loadWorkspaceConfig() is called
  Then it throws WorkspaceConfigError
  And error mentions "outputMode" must be pretty|json|raw
```

### S-8: Defaults at both levels merge correctly

```gherkin
Scenario: Complex merge scenario
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
      showSummary: true
      trace: false
    profiles:
      dev:
        baseUrl: http://localhost:3000
        defaults:
          trace: true
          outputMode: json
    """
  And profile "dev" is active
  When defaults are resolved for any method
  Then includeHeaders = true (from workspace)
  And showSummary = true (from workspace)
  And trace = true (from profile, overrides workspace)
  And outputMode = json (from profile, not in workspace)
```

### S-9: Shell commands also use defaults

```gherkin
Scenario: One-shot mode uses defaults
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
    """
  When user runs "unireq get /users" from shell
  Then response headers are included
```

### S-10: REPL commands use defaults

```gherkin
Scenario: REPL mode uses defaults
  Given workspace.yaml contains defaults.showSummary: true
  And user is in REPL mode
  When user runs "get /users"
  Then summary footer is shown
```

### S-11: Method-specific defaults apply only to that method

```gherkin
Scenario: GET-specific defaults
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      showSummary: true
      get:
        includeHeaders: true
    """
  When user runs "get /users"
  Then headers ARE included (get-specific)
  And summary IS shown (general default)
  When user runs "post /users -b '{}'"
  Then headers are NOT included (get-specific doesn't apply)
  And summary IS shown (general default still applies)
```

### S-12: Method-specific overrides general at same level

```gherkin
Scenario: Method-specific overrides general
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: false
      trace: true
      get:
        includeHeaders: true
        trace: false
    """
  When defaults are resolved for GET
  Then includeHeaders = true (get overrides general)
  And trace = false (get overrides general)
  When defaults are resolved for POST
  Then includeHeaders = false (general, no post-specific)
  And trace = true (general, no post-specific)
```

### S-13: Profile method-specific overrides workspace method-specific

```gherkin
Scenario: Full 4-level merge
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      showSummary: true           # Level 1: workspace general
      get:
        includeHeaders: true      # Level 2: workspace.get
    profiles:
      dev:
        baseUrl: http://localhost:3000
        defaults:
          trace: true             # Level 3: profile general
          get:
            outputMode: json      # Level 4: profile.get
    """
  And profile "dev" is active
  When defaults are resolved for GET
  Then showSummary = true (workspace general)
  And includeHeaders = true (workspace.get)
  And trace = true (profile general)
  And outputMode = json (profile.get)
```

### S-14: Different methods get different defaults

```gherkin
Scenario: Multiple method-specific defaults
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      showSummary: true
      get:
        includeHeaders: true
      post:
        trace: true
      delete:
        outputMode: json
    """
  When defaults are resolved for GET
  Then includeHeaders = true, trace = undefined
  When defaults are resolved for POST
  Then trace = true, includeHeaders = undefined
  When defaults are resolved for DELETE
  Then outputMode = json, includeHeaders = undefined
  And all methods have showSummary = true
```

### S-15: Empty method-specific defaults is valid

```gherkin
Scenario: Empty method defaults
  Given workspace.yaml contains:
    """
    version: 2
    name: my-api
    defaults:
      includeHeaders: true
      get: {}
    """
  When loadWorkspaceConfig() is called
  Then it succeeds
  And GET still inherits includeHeaders: true from general
```

---

## 6. Implementation Plan

### Block 1: Type Definitions

**Files:**
- `workspace/config/types.ts` (modified)

**Deliverables:**
- Define `HttpOutputDefaults` interface (base, no nesting)
- Define `HttpDefaults` interface (extends base + method keys)
- Define `HttpMethodName` type
- Add `defaults?: HttpDefaults` to `ProfileConfig`
- Add `defaults?: HttpDefaults` to `WorkspaceConfig`

**Tests:** Type compilation

**Complexity:** S

### Block 2: Schema Validation

**Files:**
- `workspace/config/schema.ts` (modified)

**Deliverables:**
- Valibot schema for `HttpOutputDefaults`
- Valibot schema for `HttpDefaults` (with method sub-schemas)
- Integration with existing config schemas
- Enum validation for `outputMode`

**Tests:** Schema validation tests

**Acceptance criteria covered:** S-5, S-6, S-7, S-15

**Complexity:** M

### Block 3: Defaults Resolution

**Files:**
- `shared/http-options.ts` (modified)

**Deliverables:**
- `resolveHttpDefaults(method, workspace, profile)` function
- 4-level merge logic (workspace → workspace.method → profile → profile.method)
- Modify `parseHttpOptions()` to accept defaults parameter
- Unit tests for all merge scenarios

**Tests:** Unit tests for resolution and merge

**Acceptance criteria covered:** S-2, S-3, S-4, S-8, S-11, S-12, S-13, S-14

**Complexity:** M

### Block 4: REPL Integration

**Files:**
- `repl/http-commands.ts` (modified)

**Deliverables:**
- Pass method name to `resolveHttpDefaults()`
- Resolve defaults from `state.workspaceConfig` and active profile
- Pass defaults to `parseHttpOptions()`

**Tests:** Integration tests

**Acceptance criteria covered:** S-1, S-10

**Complexity:** S

### Block 5: Shell Commands Integration

**Files:**
- `commands/shortcuts.ts` (modified)
- `commands/request.ts` (modified)

**Deliverables:**
- Load workspace config in shell mode
- Pass method name to resolver
- Resolve defaults before parsing
- Pass defaults to parser

**Tests:** E2E tests

**Acceptance criteria covered:** S-9

**Complexity:** M

---

## 7. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| S-1: Workspace defaults | - | Yes | - |
| S-2: Profile override | Yes | Yes | - |
| S-3: CLI override | Yes | - | - |
| S-4: Missing defaults | Yes | - | - |
| S-5: Empty defaults | Yes | - | - |
| S-6: Unknown fields | Yes | - | - |
| S-7: Invalid value | Yes | - | - |
| S-8: Complex merge | Yes | - | - |
| S-9: Shell mode | - | - | Yes |
| S-10: REPL mode | - | Yes | - |
| S-11: Method-specific | Yes | Yes | - |
| S-12: Method overrides general | Yes | - | - |
| S-13: Full 4-level merge | Yes | - | - |
| S-14: Different methods | Yes | - | - |
| S-15: Empty method defaults | Yes | - | - |

### Test Files

- `shared/__tests__/http-options.test.ts` - Defaults resolution tests (main)
- `workspace/config/__tests__/schema.test.ts` - Defaults schema validation
- `repl/__tests__/http-commands.test.ts` - REPL integration (existing, extend)
- `__tests__/cli.e2e.test.ts` - Shell mode E2E (existing, extend)

---

## 8. Example workspace.yaml

```yaml
version: 2
name: my-api

# Defaults pour TOUTES les méthodes HTTP
defaults:
  showSummary: true        # -S par défaut pour tout

  # Defaults spécifiques par méthode
  get:
    includeHeaders: true   # GET: voir les headers (cache, etag)

  post:
    trace: true            # POST: voir le timing
    outputMode: json       # POST: JSON pour parser la réponse

  put:
    trace: true            # PUT: voir le timing

  patch:
    trace: true            # PATCH: voir le timing

  delete:
    hideBody: true         # DELETE: pas besoin du body
    outputMode: json       # DELETE: juste le status

profiles:
  dev:
    baseUrl: http://localhost:3000
    defaults:
      trace: true          # Tout en trace en dev
      get:
        outputMode: pretty # Mais GET reste pretty en dev

  staging:
    baseUrl: https://staging.example.com
    # Hérite des defaults workspace

  prod:
    baseUrl: https://api.example.com
    defaults:
      showSecrets: false   # Sécurité: jamais de secrets en prod
      trace: false         # Pas de trace en prod (perf)
```

---

## 9. Resolution Example

Given the config above and `profile: dev`, here's how defaults resolve:

| Method | Final Defaults | Source |
|--------|----------------|--------|
| GET | `showSummary: true, includeHeaders: true, trace: true, outputMode: pretty` | workspace + workspace.get + profile + profile.get |
| POST | `showSummary: true, trace: true, outputMode: json` | workspace + workspace.post + profile |
| DELETE | `showSummary: true, hideBody: true, outputMode: json, trace: true` | workspace + workspace.delete + profile |

---

## Definition of Done

- [ ] `HttpOutputDefaults` interface defined
- [ ] `HttpDefaults` interface defined (with method keys)
- [ ] `HttpMethodName` type defined
- [ ] Valibot schema for defaults + methods implemented
- [ ] `resolveHttpDefaults(method, workspace, profile)` implemented
- [ ] 4-level merge logic tested
- [ ] `parseHttpOptions()` accepts defaults parameter
- [ ] REPL commands use resolved defaults with method
- [ ] Shell commands use resolved defaults with method
- [ ] All 15 BDD scenarios have passing tests
- [ ] Lint/typecheck pass
- [ ] TODO_WORKSPACE.md updated
