---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2026-01-02
  updated: 2026-01-02
---

# Specification: kubectl-Inspired Workspace/Profile Model

## 1. User Stories

### US-1: Multi-API Workspace Management

**AS A** developer working with multiple APIs
**I WANT** to manage workspaces like kubectl contexts
**SO THAT** I can easily switch between different API projects

### US-2: Multi-Environment Profile Management

**AS A** developer
**I WANT** profiles within each workspace for different environments
**SO THAT** I can switch between dev/staging/prod within the same API

### US-3: Workspace-Level and Profile-Level Secrets

**AS A** developer
**I WANT** secrets at both workspace and profile levels
**SO THAT** I can share common secrets while overriding per-environment

---

## 2. Terminology (kubectl-inspired)

| Term | Definition | kubectl Equivalent |
|------|------------|-------------------|
| **Workspace** | Configuration for 1 API | cluster |
| **Profile** | 1 environment within an API (baseUrl, vars, secrets) | context |
| **Registry** | Global index of all known workspaces | ~/.kube/config |
| **LOCAL** | Workspace in project directory (`.unireq/`) | - |
| **GLOBAL** | Workspace in user config (`~/.config/unireq/workspaces/`) | - |

---

## 3. File Structure

### Global Config Directory

```
~/.config/unireq/
├── config.yaml              # Global state: active workspace, active profile
├── workspaces/              # GLOBAL workspaces
│   ├── stripe/
│   │   └── workspace.yaml
│   └── github/
│       └── workspace.yaml
└── registry.yaml            # Index of ALL known workspaces (local + global)
```

### Local Workspace

```
<project>/.unireq/
└── workspace.yaml           # LOCAL workspace config
```

### Registry Schema (registry.yaml)

```yaml
version: 1
workspaces:
  stripe:
    path: "~/.config/unireq/workspaces/stripe"
    location: global
  my-api:
    path: "/home/user/projects/my-api/.unireq"
    location: local
```

### Global Config Schema (config.yaml)

```yaml
version: 1
activeWorkspace: my-api      # Currently active workspace name
activeProfile: dev           # Currently active profile within workspace
```

### Workspace Config Schema (workspace.yaml)

```yaml
version: 2                    # Bump version for new model
name: my-api

# Workspace-level secrets (shared across all profiles)
secrets:
  shared-key: "{{secret:my-api-shared}}"

# Profiles (environments)
profiles:
  dev:
    baseUrl: http://localhost:3000
    vars:
      logLevel: debug
    # Profile-specific secrets (override workspace secrets)
    secrets:
      api-key: "{{secret:dev-key}}"

  staging:
    baseUrl: https://staging.api.example.com
    vars:
      logLevel: info
    secrets:
      api-key: "{{secret:staging-key}}"

  prod:
    baseUrl: https://api.example.com
    vars:
      logLevel: warn
    secrets:
      api-key: "{{secret:prod-key}}"

# OpenAPI spec (optional)
openapi:
  source: ./openapi.yaml
```

---

## 4. Commands

### Workspace Commands

| Command | Description |
|---------|-------------|
| `workspace list` | List all workspaces (LOCAL + GLOBAL) |
| `workspace init [--profile <name>]` | Create LOCAL workspace in cwd |
| `workspace init --global <name> [--profile <name>]` | Create GLOBAL workspace |
| `workspace register <name> <path>` | Register existing workspace in registry |
| `workspace unregister <name>` | Remove from registry (keeps files) |
| `workspace use <name>` | Switch active workspace |
| `workspace current` | Show active workspace + profile |

### Profile Commands

| Command | Description |
|---------|-------------|
| `profile list` | List profiles in current workspace |
| `profile create <name> [options]` | Create new profile |
| `profile rename <old> <new>` | Rename profile |
| `profile delete <name>` | Delete profile (allows last) |
| `profile use <name>` | Switch active profile |
| `profile show [name]` | Show profile details |
| `profile edit [name]` | Open in $EDITOR |

### Profile Create Options

| Option | Description |
|--------|-------------|
| `--from <source>` | Clone from existing profile |
| `--copy-vars` | Copy vars from source |
| `--copy-secrets` | Copy secret refs from source |
| `--copy-all` | Copy vars + secrets |

### Status Command

| Command | Description |
|---------|-------------|
| `status` | Show: workspace / profile (baseUrl) |

---

## 5. BDD Scenarios

### Workspace Initialization

#### S-1: Init local workspace without profile

```gherkin
Scenario: Initialize local workspace without profile
  Given current directory has no .unireq/
  When user runs "workspace init"
  Then .unireq/workspace.yaml is created
  And workspace has no profiles
  And workspace is registered as "(local)" in registry
  And success message shows "Created workspace (local) with no profiles"
```

#### S-2: Init local workspace with profile

```gherkin
Scenario: Initialize local workspace with profile
  Given current directory has no .unireq/
  When user runs "workspace init --profile dev"
  Then .unireq/workspace.yaml is created
  And workspace has profile "dev"
  And "dev" is set as activeProfile in global config
  And success message shows "Created workspace (local) with profile 'dev'"
```

#### S-3: Init global workspace

```gherkin
Scenario: Initialize global workspace
  Given no workspace named "stripe" exists
  When user runs "workspace init --global stripe --profile test"
  Then ~/.config/unireq/workspaces/stripe/workspace.yaml is created
  And workspace has profile "test"
  And workspace is registered as "stripe" in registry
```

### Workspace Listing

#### S-4: List shows location markers

```gherkin
Scenario: List workspaces with location markers
  Given local workspace exists at cwd
  And global workspace "stripe" exists
  When user runs "workspace list"
  Then output shows:
    | NAME     | LOCATION | PROFILES | ACTIVE |
    | (local)  | local    | -        |        |
    | stripe   | global   | test     | *      |
```

### Profile Management

#### S-5: Create empty profile

```gherkin
Scenario: Create empty profile
  Given workspace "my-api" is active
  When user runs "profile create staging"
  Then profile "staging" is created with empty vars/secrets
  And output shows "Created profile 'staging'"
```

#### S-6: Create profile with copy-vars

```gherkin
Scenario: Clone profile with vars only
  Given workspace has profile "dev" with vars { logLevel: "debug", timeout: 30 }
  And profile "dev" has secrets { api-key: "{{secret:dev-key}}" }
  When user runs "profile create staging --from dev --copy-vars"
  Then profile "staging" has vars { logLevel: "debug", timeout: 30 }
  And profile "staging" has no secrets
```

#### S-7: Create profile with copy-secrets

```gherkin
Scenario: Clone profile with secrets only
  Given workspace has profile "dev" with secrets { api-key: "{{secret:dev-key}}" }
  When user runs "profile create staging --from dev --copy-secrets"
  Then profile "staging" has secrets { api-key: "{{secret:dev-key}}" }
  And profile "staging" has empty vars
```

#### S-8: Create profile with copy-all

```gherkin
Scenario: Clone profile with everything
  Given profile "dev" has vars and secrets
  When user runs "profile create staging --from dev --copy-all"
  Then profile "staging" is identical to "dev"
```

#### S-9: Rename profile

```gherkin
Scenario: Rename profile
  Given workspace has profile "default"
  When user runs "profile rename default dev"
  Then profile "default" no longer exists
  And profile "dev" exists with same config
  And if "default" was active, "dev" becomes active
```

#### S-10: Delete last profile

```gherkin
Scenario: Delete last profile with warning
  Given workspace has only profile "dev"
  When user runs "profile delete dev"
  Then warning shows "This is the last profile. Workspace will have no profiles."
  And profile "dev" is deleted
  And workspace has no profiles
```

### Profile Edit

#### S-11: Edit profile with $EDITOR

```gherkin
Scenario: Edit profile opens editor
  Given $EDITOR is set to "vim"
  And workspace has profile "dev"
  When user runs "profile edit dev"
  Then vim opens with workspace.yaml
  And cursor is positioned at profile "dev" section
```

#### S-12: Edit without $EDITOR

```gherkin
Scenario: Edit fails without EDITOR
  Given $EDITOR is not set
  When user runs "profile edit"
  Then error shows "$EDITOR not set. Set it with: export EDITOR=vim"
  And hint shows "Or edit manually: .unireq/workspace.yaml"
```

### Secret Resolution

#### S-13: Profile secrets override workspace secrets

```gherkin
Scenario: Profile secret overrides workspace secret
  Given workspace has secret "api-key" = "{{secret:ws-key}}"
  And profile "prod" has secret "api-key" = "{{secret:prod-key}}"
  When user in profile "prod" references "${secret:api-key}"
  Then value resolves to "{{secret:prod-key}}"
```

### Error States

#### S-14: No workspace selected

```gherkin
Scenario: HTTP command without workspace
  Given no workspace is active
  When user runs "get /users"
  Then error shows "No workspace selected."
  And hint shows "Use 'workspace init' to create one or 'workspace use <name>' to activate."
```

#### S-15: No profile selected

```gherkin
Scenario: HTTP command without profile
  Given workspace "my-api" is active
  And workspace has no profiles
  When user runs "get /users"
  Then error shows "No profile selected."
  And hint shows "Use 'profile create <name>' to create one."
```

### Local Workspace Detection

#### S-16: Hint for detected local workspace

```gherkin
Scenario: REPL shows hint for detected workspace
  Given .unireq/ exists in cwd
  And workspace is not currently active
  When user starts REPL
  Then info shows "Local workspace detected at ./.unireq/"
  And hint shows "Use 'workspace use (local)' to activate."
```

---

## 6. Implementation Plan

### Block 1: Schema and Type Updates

**Files:**
- `src/workspace/config/types.ts` (MODIFY)
- `src/workspace/config/schema.ts` (MODIFY)
- `src/workspace/registry/types.ts` (MODIFY)

**Deliverables:**
- WorkspaceConfigV2 with profiles containing vars + secrets
- GlobalConfig type for activeWorkspace + activeProfile
- Updated registry schema with location field

**Tests:** 10 schema validation tests

**Complexity:** S

### Block 2: Global Config Management

**Files:**
- `src/workspace/global-config.ts` (NEW)
- `src/workspace/__tests__/global-config.test.ts` (NEW)

**Deliverables:**
- loadGlobalConfig(), saveGlobalConfig()
- getActiveWorkspace(), setActiveWorkspace()
- getActiveProfile(), setActiveProfile()

**Tests:** 15 unit tests

**Complexity:** S

### Block 3: Workspace Commands Refactoring

**Files:**
- `src/workspace/commands.ts` (MAJOR REWRITE)
- `src/workspace/__tests__/commands.test.ts` (REWRITE)

**Deliverables:**
- `workspace init [--global <name>] [--profile <name>]`
- `workspace register/unregister`
- `workspace use/current`
- Updated `workspace list` with location markers

**Tests:** 25 unit tests

**Complexity:** M

### Block 4: Profile Commands

**Files:**
- `src/workspace/profile-commands.ts` (NEW)
- `src/workspace/__tests__/profile-commands.test.ts` (NEW)
- `src/repl/commands.ts` (MODIFY - register profile command)

**Deliverables:**
- `profile list/create/rename/delete/use/show/edit`
- Clone options: --from, --copy-vars, --copy-secrets, --copy-all

**Tests:** 30 unit tests

**Complexity:** M

### Block 5: Secret Resolution Update

**Files:**
- `src/secrets/resolver.ts` (MODIFY)
- `src/workspace/variables.ts` (MODIFY)

**Deliverables:**
- Workspace-level secrets resolution
- Profile-level secrets override
- Secret merging logic

**Tests:** 15 unit tests

**Complexity:** S

### Block 6: Help Text and UX

**Files:**
- `src/repl/help.ts` (MODIFY)
- `src/repl/engine.ts` (MODIFY - detection hint)
- `src/commands/workspace.ts` (MODIFY - shell wrapper)

**Deliverables:**
- Updated help text for all commands
- Local workspace detection hint
- Error messages for no workspace/profile

**Tests:** 10 unit tests

**Complexity:** S

### Block 7: Integration and E2E Tests

**Files:**
- `src/__tests__/workspace-profile.integration.test.ts` (NEW)
- `src/__tests__/workspace-profile.e2e.test.ts` (NEW)

**Deliverables:**
- Full workflow integration tests
- E2E tests for profile edit ($EDITOR)

**Tests:** 20 integration + 10 E2E tests

**Complexity:** M

---

## 7. Test Strategy

### Test Distribution

| Block | Unit | Integration | E2E |
|-------|------|-------------|-----|
| Block 1: Schema | 10 | - | - |
| Block 2: Global Config | 15 | - | - |
| Block 3: Workspace Cmds | 25 | 5 | - |
| Block 4: Profile Cmds | 30 | 5 | 5 |
| Block 5: Secret Resolution | 15 | 5 | - |
| Block 6: Help/UX | 10 | - | 5 |
| Block 7: Integration | - | 10 | 10 |
| **Total** | **105** | **25** | **20** |

### Mocking Strategy

- Filesystem: Real temp directories (no mocks)
- $EDITOR: Mock process.env.EDITOR
- Console: Capture via consola mocks

---

## 8. Migration Strategy

Since there's no backward compatibility requirement:

1. Bump workspace.yaml version to 2
2. Old v1 configs will fail to load with clear error
3. Users must `workspace init` fresh

---

## Definition of Done

- [x] WorkspaceConfigV2 schema implemented
- [x] Global config (activeWorkspace, activeProfile) working
- [x] `workspace init [--global] [--profile]` working
- [x] `workspace list` shows location markers
- [x] `workspace register/unregister` working
- [x] `workspace use/current` working
- [x] `profile create [--from] [--copy-vars] [--copy-secrets] [--copy-all]` working
- [x] `profile rename/delete/use/show/edit` working
- [x] Workspace-level + profile-level secrets with override
- [x] Error messages for no workspace/no profile
- [x] Local workspace detection hint
- [x] 2931 tests pass (unit + integration)
- [x] Lint/typecheck pass
- [x] Help text updated
