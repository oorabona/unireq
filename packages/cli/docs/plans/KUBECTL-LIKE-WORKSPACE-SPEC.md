# kubectl-like Workspace Auto-Creation Spec

---
doc-meta:
  status: wip
  scope: workspace
  type: spec
---

## Overview

Enable unireq to work like kubectl - commands work immediately without manual workspace initialization. Auto-creates a minimal global workspace on first use, supports `--workspace` and `--profile` CLI flags, and respects `UNIREQ_WORKSPACE`/`UNIREQ_PROFILE` environment variables.

## Goals

1. **Zero-friction onboarding**: First command "just works"
2. **Scripting-friendly**: Environment variables for CI/CD pipelines
3. **kubectl parity**: `--workspace` / `--profile` flags like `--context` / `--namespace`

## Non-Goals

- Interactive first-run wizard
- REPL changes (already requires explicit workspace)
- Deprecating `workspace init` command

## Architecture

### Resolution Priority

```
WORKSPACE:
  1. --workspace=<name> flag (highest)
  2. UNIREQ_WORKSPACE env var
  3. activeWorkspace in global config.yaml
  4. Local .unireq/ directory (findWorkspace)
  5. Auto-created global workspace (lowest)

PROFILE:
  1. --profile=<name> flag (highest)
  2. UNIREQ_PROFILE env var
  3. activeProfile in global config.yaml
  4. activeProfile in workspace.yaml
  5. No profile (lowest)
```

### File Structure

```
~/.config/unireq/
├── config.yaml          # Existing: activeWorkspace, activeProfile
├── registry.yaml        # Existing: registered workspaces
└── global/
    └── workspace.yaml   # NEW: Auto-created minimal workspace
```

### Global Workspace Content

```yaml
# Auto-created by unireq
version: 1
name: global
```

## BDD Scenarios

### S-1: Auto-create global workspace on first HTTP command

**Given** no workspace exists (no local .unireq/, no global workspace, no registry entries)
**When** user runs `unireq get https://api.example.com/health`
**Then** global workspace is created at `~/.config/unireq/global/workspace.yaml`
**And** command executes successfully
**And** no error or warning is displayed

### S-2: Use existing workspace (no auto-creation)

**Given** local .unireq/ workspace exists in current directory
**When** user runs `unireq get https://api.example.com/health`
**Then** local workspace is used
**And** global workspace is NOT created

### S-3: --workspace flag overrides everything

**Given** local .unireq/ workspace exists
**And** UNIREQ_WORKSPACE=other is set
**And** registry contains "production" workspace
**When** user runs `unireq get /users --workspace=production`
**Then** "production" workspace is loaded from registry
**And** local workspace is ignored
**And** env var is ignored

### S-4: --profile flag overrides everything

**Given** workspace with profiles: dev, staging, prod
**And** activeProfile=dev in config.yaml
**And** UNIREQ_PROFILE=staging is set
**When** user runs `unireq get /users --profile=prod`
**Then** "prod" profile is used
**And** activeProfile is ignored
**And** env var is ignored

### S-5: UNIREQ_WORKSPACE env var sets workspace

**Given** registry contains "ci-workspace" workspace
**And** UNIREQ_WORKSPACE=ci-workspace is set
**And** no --workspace flag provided
**When** user runs `unireq get /health`
**Then** "ci-workspace" is loaded from registry

### S-6: UNIREQ_PROFILE env var sets profile

**Given** workspace with profiles: default, ci
**And** UNIREQ_PROFILE=ci is set
**And** no --profile flag provided
**When** user runs `unireq get /health`
**Then** "ci" profile is used

### S-7: Invalid workspace name in flag

**Given** registry does not contain "nonexistent" workspace
**When** user runs `unireq get /users --workspace=nonexistent`
**Then** command fails with error "workspace 'nonexistent' not found"
**And** exit code is 1

### S-8: Invalid profile name in flag

**Given** workspace with profiles: dev, prod (no "admin")
**When** user runs `unireq get /users --profile=admin`
**Then** command fails with error "profile 'admin' not found in workspace"
**And** exit code is 1

### S-9: No HOME directory (container environment)

**Given** HOME environment variable is not set
**When** user runs `unireq get https://api.example.com/health`
**Then** command executes successfully (no workspace features)
**And** no error is thrown

### S-10: Permission denied on global config path

**Given** ~/.config/unireq is not writable
**When** user runs `unireq get https://api.example.com/health`
**Then** warning is logged "Cannot create global workspace: permission denied"
**And** command executes successfully (without workspace)

### S-11: Flag and env var both provided (flag wins)

**Given** UNIREQ_WORKSPACE=env-workspace is set
**When** user runs `unireq get /users --workspace=flag-workspace`
**Then** "flag-workspace" is used (flag wins)
**And** no warning about conflict

## Implementation Plan

### Block 1: Global Workspace Auto-Creation (S-1, S-2, S-9, S-10)

**Files:**
- `src/workspace/global-workspace.ts` (NEW)
- `src/workspace/global-workspace.test.ts` (NEW)

**Implementation:**
1. Create `ensureGlobalWorkspace()` function
2. Check if any workspace exists (local, registered, or global)
3. If not, create `~/.config/unireq/global/workspace.yaml`
4. Handle edge cases (no HOME, permission errors)

**Tests:** 8 unit tests

### Block 2: Environment Variables (S-5, S-6)

**Files:**
- `src/workspace/context-resolver.ts` (NEW)
- `src/workspace/context-resolver.test.ts` (NEW)

**Implementation:**
1. Create `resolveWorkspaceContext()` function
2. Read `UNIREQ_WORKSPACE` and `UNIREQ_PROFILE` env vars
3. Return resolved workspace name and profile name

**Tests:** 6 unit tests

### Block 3: CLI Flags (S-3, S-4, S-7, S-8, S-11)

**Files:**
- `src/shared/http-options.ts` (MODIFY)
- `src/commands/shortcuts.ts` (MODIFY)
- `src/commands/request.ts` (MODIFY)

**Implementation:**
1. Add `--workspace` and `--profile` to `HTTP_OPTIONS`
2. Update `loadDefaultsForMethod()` to accept explicit workspace/profile
3. Integrate with context resolver

**Tests:** 10 unit tests

### Block 4: Integration (All scenarios)

**Files:**
- `src/commands/shortcuts.ts` (MODIFY)
- `src/commands/request.ts` (MODIFY)

**Implementation:**
1. Call `ensureGlobalWorkspace()` on HTTP command start
2. Call `resolveWorkspaceContext()` to get workspace/profile
3. Pass resolved context to `loadDefaultsForMethod()`

**Tests:** 5 integration tests

## Test Requirements

| Block | Unit Tests | Integration Tests |
|-------|------------|-------------------|
| Block 1 | 8 | 0 |
| Block 2 | 6 | 0 |
| Block 3 | 10 | 0 |
| Block 4 | 0 | 5 |
| **Total** | **24** | **5** |

## Rollout

1. Auto-creation is silent (no prompts)
2. Env vars work immediately
3. Flags work immediately
4. Backward compatible (existing behavior preserved)
