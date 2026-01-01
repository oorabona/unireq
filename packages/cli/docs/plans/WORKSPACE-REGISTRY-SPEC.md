---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Workspace Registry & Doctor (Tasks 2.6 + 2.7)

## 1. User Stories

### US-1: Workspace Management (kubectl-style)

**AS A** developer using unireq
**I WANT** to manage multiple workspaces like kubectl contexts
**SO THAT** I can easily switch between different API projects

**ACCEPTANCE:** Can list, add, use, remove workspaces from a central registry

### US-2: Configuration Validation

**AS A** developer using unireq
**I WANT** to validate my workspace configuration
**SO THAT** I can catch errors before they cause problems at runtime

**ACCEPTANCE:** Doctor command reports errors and warnings for config issues

---

## 2. Business Rules

### Registry File

| Field | Value |
|-------|-------|
| Location | `~/.config/unireq/workspaces.yaml` (Linux) |
| | `~/Library/Application Support/unireq/workspaces.yaml` (macOS) |
| | `%APPDATA%\unireq\workspaces.yaml` (Windows) |
| Format | YAML with version field |

### Registry Schema

```yaml
version: 1
active: "my-api"  # currently active workspace name (optional)
workspaces:
  my-api:
    path: "/home/user/projects/my-api/.unireq"
    description: "My API project"  # optional
  another-api:
    path: "/home/user/projects/another/.unireq"
```

### Workspace Resolution Order

1. If `--workspace <name>` flag → use that workspace from registry
2. If local workspace detected (walk up from cwd) → use local
3. If registry has `active` set → use that workspace
4. Otherwise → no workspace

### Doctor Checks

| Check | Type | Description |
|-------|------|-------------|
| Schema validation | ERROR | workspace.yaml matches Valibot schema |
| Version supported | ERROR | version field is 1 |
| Variable resolution | WARNING | ${var:name} references exist |
| File references | WARNING | OpenAPI spec files exist |
| Profile references | WARNING | activeProfile exists in profiles |

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | RegistryConfig, WorkspaceEntry | TypeScript compiles |
| Registry | loadRegistry, saveRegistry | Unit tests pass |
| Commands | list, add, use, remove, doctor | Unit tests pass |
| Integration | State uses registry for resolution | Integration tests pass |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Task 2.6: Registry Commands

#### S-1: List with empty registry

```gherkin
Scenario: List workspaces with no registry
  Given no registry file exists
  And no local workspace detected
  When user runs "workspace list"
  Then output shows "No workspaces found"
  And exit code is 0
```

#### S-2: List with local workspace

```gherkin
Scenario: List shows detected local workspace
  Given no registry file exists
  And local workspace exists at current directory
  When user runs "workspace list"
  Then output shows local workspace with "(local)" marker
  And path is displayed
```

#### S-3: List registered workspaces

```gherkin
Scenario: List shows registered workspaces
  Given registry contains "api-prod" and "api-dev"
  And "api-prod" is marked active
  When user runs "workspace list"
  Then output shows both workspaces
  And "api-prod" has "*" active marker
```

#### S-4: Add workspace to registry

```gherkin
Scenario: Add new workspace
  Given registry is empty
  And valid workspace exists at "/path/to/project/.unireq"
  When user runs "workspace add my-api /path/to/project"
  Then registry contains "my-api" with path
  And success message is displayed
```

#### S-5: Add workspace - path not found

```gherkin
Scenario: Add fails for invalid path
  Given path "/invalid/path" does not exist
  When user runs "workspace add foo /invalid/path"
  Then error "Workspace not found at path" is displayed
  And registry is unchanged
```

#### S-6: Use workspace

```gherkin
Scenario: Switch active workspace
  Given registry contains "api-prod" and "api-dev"
  When user runs "workspace use api-dev"
  Then registry active is set to "api-dev"
  And success message shows "Switched to api-dev"
```

#### S-7: Remove workspace

```gherkin
Scenario: Remove workspace from registry
  Given registry contains "api-old"
  When user runs "workspace remove api-old"
  Then registry no longer contains "api-old"
  And success message is displayed
```

### Task 2.7: Doctor Command

#### S-8: Doctor - all valid

```gherkin
Scenario: Doctor passes for valid config
  Given workspace has valid workspace.yaml
  When user runs "workspace doctor"
  Then output shows "✓ All checks passed"
  And exit code is 0
```

#### S-9: Doctor - schema error

```gherkin
Scenario: Doctor reports schema errors
  Given workspace.yaml has invalid field type
  When user runs "workspace doctor"
  Then output shows "✗ Schema error: [field] [message]"
  And exit code is 1
```

#### S-10: Doctor - undefined variable

```gherkin
Scenario: Doctor warns about undefined variables
  Given workspace.yaml references ${var:undefined_var}
  When user runs "workspace doctor"
  Then output shows "⚠ Variable 'undefined_var' is not defined"
  And exit code is 0 (warnings don't fail)
```

#### S-11: Doctor - missing file

```gherkin
Scenario: Doctor warns about missing files
  Given workspace.yaml references openapi spec "missing.yaml"
  And file does not exist
  When user runs "workspace doctor"
  Then output shows "⚠ File not found: missing.yaml"
```

---

## 5. Implementation Plan

### Block 1: Registry Types and Core

**Packages:** cli

**Files:**
- `src/workspace/registry/types.ts` (NEW)
- `src/workspace/registry/schema.ts` (NEW)
- `src/workspace/registry/loader.ts` (NEW)
- `src/workspace/registry/__tests__/loader.test.ts` (NEW)

**Deliverables:**
- RegistryConfig, WorkspaceEntry types
- Valibot schema for registry
- loadRegistry(), saveRegistry(), getRegistryPath()
- Unit tests (15+ tests)

**Acceptance criteria covered:** Foundation for S-1 to S-7

**Complexity:** M
**Dependencies:** None

### Block 2: Registry Commands (list, add, use, remove)

**Packages:** cli

**Files:**
- `src/workspace/registry/commands.ts` (NEW)
- `src/workspace/registry/__tests__/commands.test.ts` (NEW)
- `src/workspace/commands.ts` (MODIFY - integrate)

**Deliverables:**
- handleList(), handleAdd(), handleUse(), handleRemove()
- Integration with workspaceHandler
- Unit tests (20+ tests)

**Acceptance criteria covered:** S-1 to S-7

**Complexity:** M
**Dependencies:** Block 1

### Block 3: Doctor Command

**Packages:** cli

**Files:**
- `src/workspace/doctor/checks.ts` (NEW)
- `src/workspace/doctor/runner.ts` (NEW)
- `src/workspace/doctor/__tests__/checks.test.ts` (NEW)
- `src/workspace/commands.ts` (MODIFY - add doctor)

**Deliverables:**
- checkSchema(), checkVariables(), checkFiles(), checkProfiles()
- runDoctor() orchestrator
- handleDoctor() command handler
- Unit tests (20+ tests)

**Acceptance criteria covered:** S-8 to S-11

**Complexity:** M
**Dependencies:** Block 1 (uses registry to find workspace)

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Empty registry list | Yes | - |
| S-2: Local workspace list | Yes | Yes |
| S-3: Registered list | Yes | - |
| S-4: Add workspace | Yes | Yes |
| S-5: Add invalid path | Yes | - |
| S-6: Use workspace | Yes | - |
| S-7: Remove workspace | Yes | - |
| S-8: Doctor valid | Yes | Yes |
| S-9: Doctor schema error | Yes | - |
| S-10: Doctor undefined var | Yes | - |
| S-11: Doctor missing file | Yes | - |

### Mocking Strategy

- **Registry file:** Use temp directories for isolation
- **Filesystem:** Real files in temp dirs (no mocks)
- **Console output:** Capture via consola mocks

---

## Definition of Done

- [x] Registry types and schema defined ✅
- [x] loadRegistry/saveRegistry implemented ✅
- [x] workspace list shows local + registered ✅
- [x] workspace add validates path and saves ✅
- [x] workspace use switches active ✅
- [x] workspace remove deletes from registry ✅
- [x] workspace doctor validates schema ✅
- [x] workspace doctor checks variables ✅
- [x] workspace doctor checks file references ✅
- [x] 55+ unit tests pass (75 new tests, 240 total in workspace) ✅
- [x] Lint/typecheck pass ✅
- [x] TODO_WORKSPACE.md updated ✅

**Completed:** 2026-01-01
