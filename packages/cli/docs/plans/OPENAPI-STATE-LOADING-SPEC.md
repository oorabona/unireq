---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2026-01-02
  updated: 2026-01-02
---

# Specification: OpenAPI Spec Loading into REPL State

## 1. User Stories

### US-1: Auto-load Spec on REPL Start

**AS A** developer starting unireq REPL
**I WANT** the OpenAPI spec to load automatically from workspace config
**SO THAT** I can use navigation and autocompletion immediately

### US-2: Auto-load Spec on Workspace Switch

**AS A** developer switching workspaces in REPL
**I WANT** the new workspace's spec to load automatically
**SO THAT** I don't have to manually reload after switching

### US-3: Manual Spec Import

**AS A** developer
**I WANT** to load a spec manually with `import` command
**SO THAT** I can use specs not configured in workspace.yaml

---

## 2. BDD Scenarios

### Auto-load on REPL Start

#### S-1: Load spec from workspace config on start

```gherkin
Scenario: Auto-load spec when REPL starts with configured workspace
  Given workspace has openapi.source = "./api.yaml"
  And file "./api.yaml" exists and is valid OpenAPI 3.0
  When REPL starts
  Then state.spec is populated with loaded spec
  And state.navigationTree is built from spec
  And welcome message shows "OpenAPI: api.yaml (3.0.0)"
```

#### S-2: No error when openapi not configured

```gherkin
Scenario: REPL starts normally without openapi config
  Given workspace has no openapi.source
  When REPL starts
  Then state.spec is undefined
  And state.navigationTree is undefined
  And no error or warning is shown
```

#### S-3: Warning when spec file not found

```gherkin
Scenario: Warning when configured spec file missing
  Given workspace has openapi.source = "./missing.yaml"
  And file "./missing.yaml" does not exist
  When REPL starts
  Then warning shows "OpenAPI spec not found: ./missing.yaml"
  And state.spec is undefined
  And REPL continues normally
```

#### S-4: Warning when spec is invalid

```gherkin
Scenario: Warning when configured spec is invalid
  Given workspace has openapi.source = "./invalid.yaml"
  And file "./invalid.yaml" contains invalid YAML
  When REPL starts
  Then warning shows "Failed to load OpenAPI spec: [parse error]"
  And state.spec is undefined
  And REPL continues normally
```

### Auto-load on Workspace Switch

#### S-5: Load spec when switching workspace

```gherkin
Scenario: Load spec when workspace use activates new workspace
  Given workspace "api-a" has openapi.source = "./a.yaml"
  And workspace "api-b" has openapi.source = "./b.yaml"
  And REPL is running with "api-a" active
  When user runs "workspace use api-b"
  Then state.spec is loaded from "./b.yaml"
  And state.navigationTree is rebuilt
  And success message shows spec loaded
```

#### S-6: Clear spec when switching to workspace without openapi

```gherkin
Scenario: Clear spec when new workspace has no openapi config
  Given workspace "with-spec" has openapi.source
  And workspace "no-spec" has no openapi.source
  And REPL is running with "with-spec" active (spec loaded)
  When user runs "workspace use no-spec"
  Then state.spec is undefined
  And state.navigationTree is undefined
```

### Import Command

#### S-7: Import spec from file path

```gherkin
Scenario: Load spec with import command
  Given REPL is running
  When user runs "import ./petstore.yaml"
  Then spec is loaded from "./petstore.yaml"
  And state.spec is populated
  And state.navigationTree is built
  And success message shows "Loaded OpenAPI spec: petstore.yaml (3.0.0)"
```

#### S-8: Import spec from URL

```gherkin
Scenario: Load spec from HTTPS URL
  Given REPL is running
  When user runs "import https://api.example.com/openapi.json"
  Then spec is fetched from URL
  And state.spec is populated
  And success message shows spec info
```

#### S-9: Import with --reload flag

```gherkin
Scenario: Force reload bypasses cache
  Given spec was previously loaded and cached
  When user runs "import ./api.yaml --reload"
  Then spec is loaded fresh (cache bypassed)
  And success message shows "Loaded OpenAPI spec (cache bypassed)"
```

#### S-10: Import replaces current spec

```gherkin
Scenario: Import replaces existing spec
  Given state.spec is already loaded with spec-A
  When user runs "import ./spec-B.yaml"
  Then state.spec contains spec-B
  And state.navigationTree reflects spec-B
```

### Error Handling

#### S-11: Import file not found

```gherkin
Scenario: Import shows error for missing file
  Given REPL is running
  When user runs "import ./nonexistent.yaml"
  Then error shows "File not found: ./nonexistent.yaml"
  And state.spec is unchanged
```

#### S-12: Import rejects HTTP (non-HTTPS) URLs

```gherkin
Scenario: Reject insecure HTTP URLs
  Given REPL is running
  When user runs "import http://api.example.com/spec.json"
  Then error shows "HTTPS required for remote URLs"
  And state.spec is unchanged
```

### Integration with Navigation

#### S-13: ls works after spec loaded

```gherkin
Scenario: ls command shows operations after spec load
  Given spec is loaded with paths /users and /users/{id}
  When user runs "ls"
  Then output shows available paths from spec
  And does NOT show "No OpenAPI spec loaded"
```

---

## 3. Implementation Plan

### Block 1: Spec Loading Helper (src/openapi/state-loader.ts)

**Files:**
- `src/openapi/state-loader.ts` (NEW)
- `src/openapi/__tests__/state-loader.test.ts` (NEW)
- `src/openapi/index.ts` (MODIFY - export)

**Deliverables:**
```typescript
interface SpecLoadResult {
  spec: LoadedSpec;
  navigationTree: NavigationTree;
}

async function loadSpecIntoState(
  state: ReplState,
  source: string,
  options?: {
    workspacePath?: string;
    forceReload?: boolean;
  }
): Promise<boolean>;

async function clearSpecFromState(state: ReplState): void;
```

**Tests:** 8 unit tests
- Load from file path
- Load from URL
- Resolve relative path
- Handle file not found
- Handle invalid spec
- Handle network error
- Force reload bypasses cache
- Clear spec from state

**Complexity:** S

### Block 2: Auto-load on REPL Start (src/repl/engine.ts)

**Files:**
- `src/repl/engine.ts` (MODIFY)
- `src/repl/__tests__/engine.test.ts` (ADD tests)

**Deliverables:**
- After `createReplState()`, check for workspace config
- If `workspaceConfig?.openapi?.source`, call `loadSpecIntoState()`
- Update welcome message to show spec info if loaded

**Tests:** 5 unit tests
- Auto-load when openapi.source configured
- No error when not configured
- Warning on spec not found
- Warning on invalid spec
- Welcome message shows spec version

**Complexity:** S

### Block 3: Auto-load on Workspace Switch (src/workspace/commands.ts)

**Files:**
- `src/workspace/commands.ts` (MODIFY - reloadWorkspaceState)

**Deliverables:**
- In `reloadWorkspaceState()`, after loading config:
  - If new workspace has `openapi.source`, load spec
  - If not, clear existing spec from state

**Tests:** 4 unit tests
- Load spec on workspace switch
- Clear spec when new workspace has no openapi
- Handle spec load error gracefully
- Show success message with spec info

**Complexity:** S

### Block 4: Import Command (src/repl/import-command.ts)

**Files:**
- `src/repl/import-command.ts` (NEW)
- `src/repl/__tests__/import-command.test.ts` (NEW)
- `src/repl/commands.ts` (MODIFY - register command)
- `src/repl/help.ts` (MODIFY - add help text)

**Deliverables:**
```typescript
// Handler: import <path-or-url> [--reload]
export const importHandler: CommandHandler;
export function createImportCommand(): Command;
```

**Tests:** 10 unit tests
- Import from file path
- Import from URL
- Import with --reload flag
- Import replaces existing spec
- Error: file not found
- Error: HTTP rejected (HTTPS required)
- Error: invalid spec
- Error: no argument provided
- Help text displayed
- Success message with spec info

**Complexity:** S

---

## 4. Test Strategy

### Test Distribution

| Block | Unit | Integration |
|-------|------|-------------|
| Block 1: State Loader | 8 | - |
| Block 2: REPL Start | 5 | 2 |
| Block 3: Workspace Switch | 4 | 2 |
| Block 4: Import Command | 10 | 2 |
| **Total** | **27** | **6** |

### Mocking Strategy

- Filesystem: Use real temp directories
- Network: Mock fetch for URL tests
- State: Direct manipulation

---

## 5. Definition of Done

- [x] `loadSpecIntoState()` helper implemented ✅ 2026-01-02
- [x] Auto-load on REPL start working ✅ 2026-01-02
- [x] Auto-load on `workspace use` working ✅ 2026-01-02
- [x] `import <path>` command working ✅ 2026-01-02
- [x] `import --reload` flag working ✅ 2026-01-02
- [x] Error handling (not found, invalid, network) ✅ 2026-01-02
- [x] Welcome message shows spec info ✅ 2026-01-02
- [x] Help text updated for import command ✅ 2026-01-02
- [x] 21 tests pass (12 state-loader + 9 import-command) ✅ 2026-01-02
- [x] Lint/typecheck pass ✅ 2026-01-02
