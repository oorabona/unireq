---
doc-meta:
  status: canonical
  scope: cli-core
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: CLI Core Project Setup (Task 1.1)

## 1. User Stories

### US-1: Package Integration

```
AS A contributor to @unireq monorepo
I WANT the @unireq/cli package to be properly configured
SO THAT I can develop CLI features with standard tooling (build, test, lint)

ACCEPTANCE: pnpm install, build, test, type-check all work
```

### US-2: Binary Execution

```
AS A developer using @unireq/cli
I WANT the CLI to be executable via `unireq` command
SO THAT I can invoke it directly from terminal after npm install -g

ACCEPTANCE: bin entry works with shebang, executable after global install
```

## 2. Business Rules

### BR-1: Monorepo Consistency

- **Invariant:** Package structure must match existing packages (http, core, etc.)
- **Invariant:** Dependencies use `workspace:*` for internal, `catalog:` for external
- **Effect:** Package integrates seamlessly with monorepo workflows

### BR-2: ESM Module Format

- **Invariant:** Package uses `"type": "module"` (ESM only)
- **Invariant:** No CommonJS exports
- **Effect:** Compatible with modern Node.js and tree-shaking

### BR-3: Build Configuration

- **Precondition:** tsup installed via catalog
- **Effect:** `dist/` contains ESM bundle with .d.ts declarations
- **Effect:** Source maps generated for debugging

### BR-4: Test Integration

- **Precondition:** Root vitest.config.ts covers all packages
- **Effect:** `pnpm test` runs cli package tests
- **Effect:** Coverage thresholds apply to cli package

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Package Config | package.json, tsconfig.json, tsup.config.ts | pnpm install succeeds |
| Source Entry | src/index.ts, src/cli.ts | tsc --noEmit passes |
| Root Config | tsconfig.json paths, vitest coverage | pnpm -r build succeeds |
| Build Output | dist/*.js, dist/*.d.ts | Files exist after build |

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Package Installation

```gherkin
Scenario: Package dependencies resolve correctly
  Given the cli package has package.json with workspace dependencies
  When I run "pnpm install" at monorepo root
  Then node_modules/.pnpm contains @unireq/cli dependencies
  And no resolution errors occur
```

### Scenario 2: Package Build

```gherkin
Scenario: Package builds successfully
  Given the cli package has tsup.config.ts
  When I run "pnpm --filter @unireq/cli build"
  Then packages/cli/dist/index.js exists
  And packages/cli/dist/index.d.ts exists
  And packages/cli/dist/cli.js exists with shebang
```

### Scenario 3: Type Checking

```gherkin
Scenario: TypeScript compilation succeeds
  Given the cli package has tsconfig.json extending root
  When I run "pnpm --filter @unireq/cli type-check"
  Then no TypeScript errors are reported
  And @unireq/http types are resolved
```

### Scenario 4: Lint Passes

```gherkin
Scenario: Biome lint succeeds
  Given the cli package has source files
  When I run "pnpm biome check packages/cli"
  Then no lint errors are reported
```

### Scenario 5: Binary Entry Point

```gherkin
Scenario: CLI binary is properly configured
  Given package.json has bin entry "unireq": "./dist/cli.js"
  When I inspect dist/cli.js after build
  Then first line is "#!/usr/bin/env node"
  And file exports main function
```

### Scenario 6: Test Framework Integration

```gherkin
Scenario: Tests run without errors
  Given the cli package has src/__tests__/ directory
  When I run "pnpm --filter @unireq/cli test"
  Then vitest runs (even with no test files)
  And exit code is 0
```

### Scenario 7: Monorepo Build Order

```gherkin
Scenario: Package builds in correct order
  Given cli depends on @unireq/http
  When I run "pnpm -r build"
  Then core builds before http
  And http builds before cli
  And all packages build successfully
```

## 5. Implementation Plan

### Block 1: Package Configuration Files

**Packages:** packages/cli

**Files to create:**
- `packages/cli/package.json` - Package manifest with deps, scripts, bin
- `packages/cli/tsconfig.json` - Extends root, paths for @unireq/*
- `packages/cli/tsup.config.ts` - Build config matching http package

**Acceptance criteria covered:** #1, #2, #3, #5

**Complexity:** S (small - configuration only)
**Dependencies:** None

### Block 2: Source Entry Points

**Packages:** packages/cli

**Files to create:**
- `packages/cli/src/index.ts` - Main export (minimal placeholder)
- `packages/cli/src/cli.ts` - Binary entry with shebang banner

**Acceptance criteria covered:** #2, #3, #4, #5

**Complexity:** S (small - minimal code)
**Dependencies:** Block 1

### Block 3: Root Configuration Updates

**Packages:** root

**Files to modify:**
- `tsconfig.json` - Add `@unireq/cli` path mapping
- `vitest.config.ts` - Ensure cli package included in coverage

**Acceptance criteria covered:** #3, #6, #7

**Complexity:** S (small - 2 line additions)
**Dependencies:** Block 1

### Block 4: Verification

**Packages:** all

**Actions:**
- Run `pnpm install`
- Run `pnpm -r build`
- Run `pnpm --filter @unireq/cli type-check`
- Run `pnpm biome check packages/cli`
- Run `pnpm --filter @unireq/cli test`

**Acceptance criteria covered:** All (#1-#7)

**Complexity:** S (verification only)
**Dependencies:** Blocks 1-3

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Package installation | - | Yes (pnpm install) | - |
| Package build | - | Yes (pnpm build) | - |
| Type checking | - | Yes (tsc --noEmit) | - |
| Lint passes | - | Yes (biome check) | - |
| Binary entry | - | Yes (file inspection) | - |
| Test framework | - | Yes (vitest run) | - |
| Build order | - | Yes (pnpm -r build) | - |

**Note:** This is infrastructure setup - tests are shell command verification, not code unit tests. Actual unit tests will be added in Task 1.2+.

### Verification Commands

```bash
# Block 1-3: After implementation
pnpm install
pnpm -r build
pnpm --filter @unireq/cli type-check
pnpm biome check packages/cli
pnpm --filter @unireq/cli test

# Verify outputs
ls packages/cli/dist/
head -1 packages/cli/dist/cli.js  # Check shebang
```

---

## Definition of Done

- [ ] All 4 blocks implemented
- [ ] All 7 BDD scenarios verified
- [ ] pnpm install succeeds
- [ ] pnpm -r build succeeds (all packages)
- [ ] pnpm --filter @unireq/cli type-check succeeds
- [ ] pnpm biome check packages/cli succeeds
- [ ] dist/cli.js has shebang
- [ ] TODO_CLI_CORE.md updated (Task 1.1 marked done)
