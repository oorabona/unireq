---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: REPL Filesystem Navigation (Task 1.6)

## 1. User Stories

### US-1: Show Current Path

**AS A** developer using @unireq/cli REPL
**I WANT** to type `pwd` to see my current API path
**SO THAT** I know where I am in the API structure

**ACCEPTANCE:** Current path displayed (e.g., `/users`)

### US-2: Navigate to Path

**AS A** developer using @unireq/cli REPL
**I WANT** to type `cd /api/users` to navigate to that path
**SO THAT** I can focus on a specific API section

**ACCEPTANCE:** Path changes and prompt updates

### US-3: List Current Context

**AS A** developer using @unireq/cli REPL
**I WANT** to type `ls` to see what's available at current path
**SO THAT** I can explore available endpoints

**ACCEPTANCE:** Placeholder message shown (OpenAPI not yet integrated)

---

## 2. Business Rules

### Path Navigation

- Paths are virtual (not real filesystem)
- All paths start with `/`
- `cd <path>` supports absolute (`/foo`), relative (`bar`), and parent (`..`)
- `cd` without argument navigates to root `/`
- Multiple `..` allowed: `cd ../..`
- Path normalization removes trailing slashes and redundant segments

### Path Normalization Rules

1. Remove trailing slashes: `/foo/` → `/foo`
2. Collapse multiple slashes: `//foo///bar` → `/foo/bar`
3. Resolve parent segments: `/foo/bar/../baz` → `/foo/baz`
4. Parent at root stays at root: `/..` → `/`
5. Empty path becomes root: `` → `/`

### Error Handling

- All navigation commands display output via consola
- Invalid operations (none defined) show clear error messages
- REPL continues after any navigation command

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| REPL Commands | New `src/repl/navigation.ts` module |
| REPL Commands | `pwd`, `cd`, `ls` command handlers |
| REPL Commands | Path utility functions (normalize, resolve) |
| REPL State | Update `currentPath` on `cd` |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: pwd Command

```gherkin
Scenario: Display current path
  Given the REPL is at path "/api/users"
  When user types "pwd"
  Then output shows "/api/users"
```

### S-2: cd Absolute Path

```gherkin
Scenario: Navigate to absolute path
  Given the REPL is at path "/"
  When user types "cd /api/users"
  Then current path becomes "/api/users"
  And prompt shows "unireq /api/users> "
```

### S-3: cd Relative Path

```gherkin
Scenario: Navigate to relative path
  Given the REPL is at path "/api"
  When user types "cd users"
  Then current path becomes "/api/users"
```

### S-4: cd Parent Path

```gherkin
Scenario: Navigate to parent path
  Given the REPL is at path "/api/users"
  When user types "cd .."
  Then current path becomes "/api"
```

### S-5: cd Root

```gherkin
Scenario: Navigate to root with cd /
  Given the REPL is at path "/api/users"
  When user types "cd /"
  Then current path becomes "/"
```

### S-6: cd Without Argument

```gherkin
Scenario: Navigate to root with bare cd
  Given the REPL is at path "/api/users"
  When user types "cd"
  Then current path becomes "/"
```

### S-7: cd Parent at Root

```gherkin
Scenario: Parent navigation at root stays at root
  Given the REPL is at path "/"
  When user types "cd .."
  Then current path stays "/"
```

### S-8: ls Placeholder

```gherkin
Scenario: List without OpenAPI
  Given no OpenAPI spec is loaded
  When user types "ls"
  Then output shows guidance message about loading spec
```

### S-9: Path Normalization

```gherkin
Scenario: Normalize complex paths
  Given the REPL is at path "/"
  When user types "cd /api//users/../admins/"
  Then current path becomes "/api/admins"
```

---

## 5. Implementation Plan

### Block 1: Path Utilities

**Files:**
- `src/repl/path-utils.ts` (NEW)
- `src/__tests__/path-utils.test.ts` (NEW)

**Deliverables:**
- `normalizePath(path: string): string` - Normalize path
- `resolvePath(currentPath: string, targetPath: string): string` - Resolve relative to absolute

**Acceptance criteria covered:** S-9 (normalization)

### Block 2: Navigation Commands

**Files:**
- `src/repl/navigation.ts` (NEW)
- `src/__tests__/navigation.test.ts` (NEW)
- `src/repl/commands.ts` (MODIFY)
- `src/repl/index.ts` (MODIFY)

**Deliverables:**
- `pwdHandler` - Display current path
- `cdHandler` - Change directory with state update
- `lsHandler` - Placeholder listing
- Register commands in `createDefaultRegistry()`

**Acceptance criteria covered:** S-1, S-2, S-3, S-4, S-5, S-6, S-7, S-8

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: pwd | Yes (handler) | - |
| S-2: cd absolute | Yes (path utils + handler) | - |
| S-3: cd relative | Yes (path utils + handler) | - |
| S-4: cd parent | Yes (path utils + handler) | - |
| S-5: cd root | Yes (handler) | - |
| S-6: cd no-arg | Yes (handler) | - |
| S-7: cd parent at root | Yes (path utils) | - |
| S-8: ls placeholder | Yes (handler) | - |
| S-9: normalization | Yes (path utils) | - |

### Test Data

- Various path combinations for normalization
- Mock ReplState for handler tests

---

## Definition of Done

- [ ] Block 1: Path utilities with comprehensive tests
- [ ] Block 2: Navigation commands registered in REPL
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (unit)
- [ ] Lint/typecheck pass
- [ ] TODO updated
