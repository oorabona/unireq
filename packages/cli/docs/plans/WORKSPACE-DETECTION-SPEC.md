---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Workspace Detection (Task 2.1)

## 1. User Stories

### US-1: Local Workspace Detection

**AS A** developer using unireq in a project directory
**I WANT** the CLI to automatically find my `.unireq/` workspace
**SO THAT** I can use project-specific configuration without explicit flags

**ACCEPTANCE:** `findWorkspace()` returns path to nearest `.unireq/` walking up from cwd

### US-2: Global Workspace Path Resolution

**AS A** developer using unireq without a local workspace
**I WANT** access to a global configuration location
**SO THAT** I can store shared workspaces across projects

**ACCEPTANCE:** `getGlobalWorkspacePath()` returns OS-appropriate config path

---

## 2. Business Rules

### Workspace Discovery Algorithm

1. Start from current working directory
2. Check if `.unireq/` directory exists
3. If found → return path, stop
4. If not found → move to parent directory
5. Repeat until root is reached
6. If root reached without finding → return `null`

### Global Path Resolution

| OS | Environment Variable | Default Path |
|----|---------------------|--------------|
| Linux | `$XDG_CONFIG_HOME/unireq` | `~/.config/unireq` |
| macOS | - | `~/Library/Application Support/unireq` |
| Windows | `%APPDATA%\unireq` | `C:\Users\<user>\AppData\Roaming\unireq` |

### Invariants

- `.unireq` MUST be a directory (files ignored)
- Symlinks MUST be followed and resolved
- Detection MUST be synchronous (for CLI startup)
- No workspace creation in detection (read-only)

### Workspace Result Type

```typescript
interface WorkspaceInfo {
  path: string;        // Absolute path to .unireq/
  scope: 'local' | 'global';
}
```

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| New Module | `src/workspace/detection.ts` |
| New Module | `src/workspace/paths.ts` |
| New Module | `src/workspace/types.ts` |
| New Module | `src/workspace/index.ts` |
| Tests | `src/__tests__/workspace-detection.test.ts` |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Find workspace in current directory

```gherkin
Scenario: Workspace exists in current directory
  Given a directory "/project" with ".unireq/" subdirectory
  When findWorkspace() is called from "/project"
  Then it returns { path: "/project/.unireq", scope: "local" }
```

### S-2: Find workspace in parent directory

```gherkin
Scenario: Workspace exists in parent directory
  Given a directory "/project/.unireq/" exists
  And current directory is "/project/src/utils"
  When findWorkspace() is called
  Then it returns { path: "/project/.unireq", scope: "local" }
```

### S-3: No workspace found

```gherkin
Scenario: No workspace in hierarchy
  Given no ".unireq/" directory exists in any parent
  When findWorkspace() is called
  Then it returns null
```

### S-4: File named .unireq ignored

```gherkin
Scenario: .unireq is a file not directory
  Given "/project/.unireq" is a regular file
  When findWorkspace() is called from "/project"
  Then it continues searching parent directories
  And returns null if no directory found
```

### S-5: Nearest workspace wins

```gherkin
Scenario: Multiple workspaces in hierarchy
  Given "/parent/.unireq/" exists
  And "/parent/child/.unireq/" exists
  When findWorkspace() is called from "/parent/child/deep"
  Then it returns { path: "/parent/child/.unireq", scope: "local" }
```

### S-6: Global path on Linux with XDG

```gherkin
Scenario: Linux with XDG_CONFIG_HOME set
  Given platform is "linux"
  And XDG_CONFIG_HOME is "/custom/config"
  When getGlobalWorkspacePath() is called
  Then it returns "/custom/config/unireq"
```

### S-7: Global path on Linux without XDG

```gherkin
Scenario: Linux without XDG_CONFIG_HOME
  Given platform is "linux"
  And XDG_CONFIG_HOME is not set
  And HOME is "/home/user"
  When getGlobalWorkspacePath() is called
  Then it returns "/home/user/.config/unireq"
```

### S-8: Global path on macOS

```gherkin
Scenario: macOS global path
  Given platform is "darwin"
  And HOME is "/Users/dev"
  When getGlobalWorkspacePath() is called
  Then it returns "/Users/dev/Library/Application Support/unireq"
```

### S-9: Global path on Windows

```gherkin
Scenario: Windows global path
  Given platform is "win32"
  And APPDATA is "C:\Users\dev\AppData\Roaming"
  When getGlobalWorkspacePath() is called
  Then it returns "C:\Users\dev\AppData\Roaming\unireq"
```

### S-10: Symlinked workspace directory

```gherkin
Scenario: .unireq is a symlink to directory
  Given "/project/.unireq" is a symlink to "/shared/workspace"
  When findWorkspace() is called from "/project"
  Then it returns { path: "/project/.unireq", scope: "local" }
```

---

## 5. Implementation Plan

### Block 1: Types and Constants

**Files:**
- `src/workspace/types.ts` (NEW)
- `src/workspace/constants.ts` (NEW)

**Deliverables:**
- `WorkspaceInfo` interface
- `WorkspaceScope` type
- `WORKSPACE_DIR_NAME` constant (`.unireq`)

**Tests:** Type definitions (compile-time)

**Acceptance criteria covered:** (foundational)

**Complexity:** S

### Block 2: Global Path Resolution

**Files:**
- `src/workspace/paths.ts` (NEW)

**Deliverables:**
- `getGlobalWorkspacePath()` function
- Platform detection logic
- Environment variable handling

**Tests:** Unit tests for each platform

**Acceptance criteria covered:** S-6, S-7, S-8, S-9

**Complexity:** S

### Block 3: Workspace Detection

**Files:**
- `src/workspace/detection.ts` (NEW)
- `src/workspace/index.ts` (NEW)

**Deliverables:**
- `findWorkspace()` function
- Directory walking logic
- Symlink handling

**Tests:** Unit tests with mocked fs

**Acceptance criteria covered:** S-1, S-2, S-3, S-4, S-5, S-10

**Complexity:** M

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Workspace in cwd | Yes | - |
| S-2: Workspace in parent | Yes | - |
| S-3: No workspace | Yes | - |
| S-4: File not directory | Yes | - |
| S-5: Nearest wins | Yes | - |
| S-6: Linux XDG set | Yes | - |
| S-7: Linux XDG unset | Yes | - |
| S-8: macOS path | Yes | - |
| S-9: Windows path | Yes | - |
| S-10: Symlink handling | Yes | - |

### Test Approach

- Use `memfs` or mock `fs` for filesystem tests
- Mock `process.platform` for cross-platform tests
- Mock `process.env` for environment variable tests
- All tests must be fast (no real filesystem I/O)

### Test Files

- `src/__tests__/workspace-detection.test.ts` - Detection logic
- `src/__tests__/workspace-paths.test.ts` - Global path resolution

---

## Definition of Done

- [x] Types defined (WorkspaceInfo, WorkspaceScope) ✅ 2025-12-31
- [x] `getGlobalWorkspacePath()` implemented with tests ✅ 2025-12-31
- [x] `findWorkspace()` implemented with tests ✅ 2025-12-31
- [x] All 10 BDD scenarios have passing tests ✅ 2025-12-31
- [x] Lint/typecheck pass ✅ 2025-12-31
- [x] TODO_WORKSPACE.md updated ✅ 2025-12-31
