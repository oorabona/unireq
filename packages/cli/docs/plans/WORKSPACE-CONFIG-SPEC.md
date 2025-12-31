---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Workspace Config Schema and Loader (Task 2.2)

## 1. User Stories

### US-1: Load Workspace Configuration

**AS A** developer using unireq in a project with a `.unireq/` workspace
**I WANT** the CLI to load and validate my `workspace.yaml` configuration
**SO THAT** I can configure baseUrl, profiles, and variables without passing flags every time

**ACCEPTANCE:** `loadWorkspaceConfig(workspacePath)` returns typed `WorkspaceConfig` or throws `WorkspaceConfigError`

### US-2: Graceful Handling of Missing Config

**AS A** developer using unireq in a workspace without `workspace.yaml`
**I WANT** the CLI to work with sensible defaults
**SO THAT** I can use the workspace for collections/history without mandatory config

**ACCEPTANCE:** `loadWorkspaceConfig()` returns `null` when file doesn't exist

---

## 2. Business Rules

### Config File Location

- Config file MUST be named `workspace.yaml` (not `.yaml`, not `.yml`)
- Config file MUST be located at `{workspacePath}/workspace.yaml`
- File MUST be valid YAML 1.2

### Schema Version

- `version` field MUST be present and MUST equal `1`
- Unsupported versions MUST throw `WorkspaceConfigError`
- Future: migration functions for version upgrades

### Field Validation

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `version` | number | Yes | - | Must be `1` |
| `name` | string | No | - | Non-empty if present |
| `baseUrl` | string | No | - | Valid URL if present |
| `openapi.source` | string | No | - | Valid URL or file path |
| `openapi.cache.enabled` | boolean | No | `true` | - |
| `openapi.cache.ttlMs` | number | No | `86400000` | Positive integer |
| `profiles` | object | No | `{}` | Map of profile configs |
| `profiles.*.headers` | object | No | `{}` | Map of header name→value |
| `profiles.*.timeoutMs` | number | No | `30000` | Positive integer |
| `profiles.*.verifyTls` | boolean | No | `true` | - |
| `auth.active` | string | No | - | Must match a provider key |
| `auth.providers` | object | No | `{}` | Map of provider configs |
| `vars` | object | No | `{}` | Map of string→string |

### Invariants

- Unknown fields MUST be preserved (forward compatibility via Valibot `looseObject()`)
- Empty file MUST return config with defaults only
- Config values are NOT interpolated at load time (that's Task 2.4)

### Error Handling

- YAML syntax errors MUST include line/column information
- Schema validation errors MUST include field path
- File permission errors MUST be caught and wrapped
- All errors MUST be `WorkspaceConfigError` instances

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| New Module | `src/workspace/config/schema.ts` - Valibot schemas |
| New Module | `src/workspace/config/loader.ts` - loadWorkspaceConfig() |
| New Module | `src/workspace/config/errors.ts` - WorkspaceConfigError |
| New Module | `src/workspace/config/types.ts` - TypeScript types |
| New Module | `src/workspace/config/index.ts` - exports |
| Updated | `src/workspace/index.ts` - re-export config |
| Tests | `src/__tests__/workspace-config-schema.test.ts` |
| Tests | `src/__tests__/workspace-config-loader.test.ts` |
| Dependencies | Add `yaml` and `valibot` to package.json |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Load valid full config

```gherkin
Scenario: Load workspace.yaml with all fields
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains valid config with all fields
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it returns WorkspaceConfig with all values parsed
  And version equals 1
  And baseUrl equals the configured value
```

### S-2: Load minimal config (version only)

```gherkin
Scenario: Load workspace.yaml with only required fields
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains only "version: 1"
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it returns WorkspaceConfig with defaults
  And profiles is empty object
  And vars is empty object
```

### S-3: Missing workspace.yaml returns null

```gherkin
Scenario: No workspace.yaml file exists
  Given a workspace at "/project/.unireq"
  And no workspace.yaml file exists
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it returns null
```

### S-4: Empty file returns defaults

```gherkin
Scenario: Empty workspace.yaml file
  Given a workspace at "/project/.unireq"
  And workspace.yaml is empty
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it throws WorkspaceConfigError
  And error message mentions "version" is required
```

### S-5: Invalid YAML syntax

```gherkin
Scenario: Malformed YAML syntax
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains invalid YAML "version: [unterminated"
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it throws WorkspaceConfigError
  And error message contains line number
```

### S-6: Schema validation error

```gherkin
Scenario: Wrong type for field
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains "version: 'one'" (string instead of number)
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it throws WorkspaceConfigError
  And error message mentions "version" field
```

### S-7: Unsupported version

```gherkin
Scenario: Version 2 not supported
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains "version: 2"
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it throws WorkspaceConfigError
  And error message mentions "unsupported version"
```

### S-8: Unknown fields preserved

```gherkin
Scenario: Forward compatibility with unknown fields
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains "version: 1" and "futureField: value"
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it returns WorkspaceConfig successfully
  And the raw config includes "futureField"
```

### S-9: Default values applied

```gherkin
Scenario: Default values for optional fields
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains "version: 1" and partial profile config
  When loadWorkspaceConfig("/project/.unireq") is called
  Then profile.timeoutMs defaults to 30000
  And profile.verifyTls defaults to true
  And openapi.cache.enabled defaults to true
```

### S-10: Invalid URL rejected

```gherkin
Scenario: Invalid baseUrl format
  Given a workspace at "/project/.unireq"
  And workspace.yaml contains "baseUrl: not-a-url"
  When loadWorkspaceConfig("/project/.unireq") is called
  Then it throws WorkspaceConfigError
  And error message mentions "baseUrl" and "URL"
```

---

## 5. Implementation Plan

### Block 1: Dependencies and Types

**Files:**
- `package.json` (modified) - add yaml, zod
- `src/workspace/config/types.ts` (NEW)

**Deliverables:**
- Add `yaml` and `valibot` to dependencies using `catalog:`
- Define TypeScript interfaces for WorkspaceConfig
- Define WorkspaceConfigError class

**Tests:** Type definitions (compile-time)

**Acceptance criteria covered:** (foundational)

**Complexity:** S

### Block 2: Valibot Schema

**Files:**
- `src/workspace/config/schema.ts` (NEW)

**Deliverables:**
- Valibot schema for workspace.yaml version 1
- Schema with defaults and transforms
- Export inferred TypeScript types

**Tests:** Unit tests for schema validation

**Acceptance criteria covered:** S-2, S-6, S-7, S-8, S-9, S-10

**Complexity:** M

### Block 3: Config Loader

**Files:**
- `src/workspace/config/loader.ts` (NEW)
- `src/workspace/config/errors.ts` (NEW)
- `src/workspace/config/index.ts` (NEW)
- `src/workspace/index.ts` (modified)

**Deliverables:**
- `loadWorkspaceConfig(workspacePath)` function
- YAML parsing with error handling
- Integration with Valibot schema
- Re-export from workspace module

**Tests:** Unit tests for loader function

**Acceptance criteria covered:** S-1, S-3, S-4, S-5

**Complexity:** M

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Full config | Yes | - |
| S-2: Minimal config | Yes | - |
| S-3: Missing file | Yes | - |
| S-4: Empty file | Yes | - |
| S-5: Invalid YAML | Yes | - |
| S-6: Schema error | Yes | - |
| S-7: Unsupported version | Yes | - |
| S-8: Unknown fields | Yes | - |
| S-9: Default values | Yes | - |
| S-10: Invalid URL | Yes | - |

### Test Approach

- Use real temp directories for file-based tests
- Test Valibot schema directly for validation logic
- Test loader with various YAML fixtures
- All tests follow AAA pattern

### Test Files

- `src/__tests__/workspace-config-schema.test.ts` - Schema validation
- `src/__tests__/workspace-config-loader.test.ts` - Loader function

---

## Definition of Done

- [x] Dependencies added (yaml, valibot)
- [x] TypeScript types defined (WorkspaceConfig, etc.)
- [x] Valibot schema implemented with defaults
- [x] loadWorkspaceConfig() implemented
- [x] WorkspaceConfigError with helpful messages
- [x] All 10 BDD scenarios have passing tests
- [x] Lint/typecheck pass
- [ ] TODO_WORKSPACE.md updated
