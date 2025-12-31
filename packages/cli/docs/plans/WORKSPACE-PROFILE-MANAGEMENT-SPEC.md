---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Profile Management (Task 2.3)

## 1. User Stories

### US-1: Switch Between Environments

**AS A** developer working with an API
**I WANT** to switch between environment profiles (dev, staging, prod)
**SO THAT** I can easily target different environments without editing config

**ACCEPTANCE:** `profile use dev` changes the active profile and subsequent requests use dev settings

### US-2: List Available Profiles

**AS A** developer exploring a workspace
**I WANT** to see all available profiles
**SO THAT** I know which environments I can switch to

**ACCEPTANCE:** `profile list` shows all profile names with active marker

### US-3: View Current Profile

**AS A** developer during a session
**I WANT** to see my current profile settings
**SO THAT** I know what configuration is active

**ACCEPTANCE:** `profile show` displays active profile name and its settings

## 2. Business Rules

### BR-1: Profile Resolution

- Profiles override workspace-level settings
- Resolution order: workspace defaults → active profile overrides
- Only defined profile fields override (undefined = inherit from workspace)

### BR-2: Active Profile Tracking

- `activeProfile` field in config specifies default profile on load
- If no activeProfile, first defined profile is used (or "default" if exists)
- Active profile can be changed at runtime via REPL command
- Runtime changes don't persist to file (session only)

### BR-3: Profile Fields

Profile can override:
- `baseUrl` - API base URL
- `headers` - HTTP headers (merged with workspace headers)
- `timeoutMs` - Request timeout
- `verifyTls` - TLS verification
- `vars` - Variables (merged with workspace vars)

### BR-4: Header Merging

- Profile headers merge with workspace headers
- Profile headers take precedence on conflict
- Empty string value removes header from workspace

### BR-5: Variable Merging

- Profile vars merge with workspace vars
- Profile vars take precedence on conflict
- Variables from profile are resolved like workspace vars

## 3. Technical Impact

### Schema Changes (schema.ts)

```typescript
// Add to workspaceConfigSchema
activeProfile: v.optional(v.string()),

// Extend profileSchema
const profileSchema = v.object({
  baseUrl: v.optional(urlSchema),
  headers: v.optional(v.record(v.string(), v.string())),
  timeoutMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  verifyTls: v.optional(v.boolean()),
  vars: v.optional(v.record(v.string(), v.string())),
});
```

### Type Changes (types.ts)

```typescript
export interface ProfileConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  verifyTls?: boolean;
  vars?: Record<string, string>;
}

export interface WorkspaceConfig {
  // ... existing fields
  activeProfile?: string;
}
```

### New Module: profiles/resolver.ts

```typescript
export interface ResolvedProfile {
  name: string;
  baseUrl?: string;
  headers: Record<string, string>;
  timeoutMs: number;
  verifyTls: boolean;
  vars: Record<string, string>;
}

export function resolveProfile(
  config: WorkspaceConfig,
  profileName?: string
): ResolvedProfile;

export function getActiveProfileName(config: WorkspaceConfig): string | undefined;

export function listProfiles(config: WorkspaceConfig): string[];
```

### State Changes (state.ts)

```typescript
export interface ReplState {
  // ... existing fields
  activeProfile?: string;
  workspaceConfig?: WorkspaceConfig;
}
```

### New Commands (profiles/commands.ts)

- `profile` / `profile list` - List all profiles
- `profile use <name>` - Switch to profile
- `profile show` - Show current profile details

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: List profiles

```gherkin
Given a workspace with profiles "dev", "staging", "prod"
And activeProfile is "dev"
When user runs "profile list"
Then output shows:
  "dev (active)"
  "staging"
  "prod"
```

### Scenario 2: Switch profile

```gherkin
Given a workspace with profiles "dev" and "prod"
And activeProfile is "dev"
When user runs "profile use prod"
Then activeProfile changes to "prod"
And output confirms "Switched to profile: prod"
```

### Scenario 3: Switch to non-existent profile

```gherkin
Given a workspace with profiles "dev" and "prod"
When user runs "profile use unknown"
Then error shows "Profile 'unknown' not found"
And output lists available profiles
```

### Scenario 4: Show profile details

```gherkin
Given a workspace with profile "dev" containing:
  - baseUrl: "https://dev.api.example.com"
  - headers: { "X-Env": "dev" }
When user runs "profile show"
Then output shows profile name and all settings
```

### Scenario 5: Profile overrides baseUrl

```gherkin
Given a workspace with baseUrl "https://api.example.com"
And profile "dev" with baseUrl "https://dev.api.example.com"
When profile "dev" is active
And resolveProfile is called
Then resolved baseUrl is "https://dev.api.example.com"
```

### Scenario 6: Profile merges headers

```gherkin
Given a workspace with headers { "User-Agent": "unireq", "X-Custom": "base" }
And profile "dev" with headers { "X-Custom": "dev", "X-Env": "dev" }
When profile "dev" is active
And resolveProfile is called
Then resolved headers are:
  - "User-Agent": "unireq" (from workspace)
  - "X-Custom": "dev" (from profile, overrides)
  - "X-Env": "dev" (from profile)
```

### Scenario 7: Profile merges vars

```gherkin
Given a workspace with vars { "tenantId": "default", "env": "prod" }
And profile "dev" with vars { "env": "development" }
When profile "dev" is active
And resolveProfile is called
Then resolved vars are:
  - "tenantId": "default" (from workspace)
  - "env": "development" (from profile, overrides)
```

### Scenario 8: No profiles defined

```gherkin
Given a workspace with no profiles
When user runs "profile list"
Then output shows "No profiles defined"
```

### Scenario 9: Default profile selection

```gherkin
Given a workspace with profiles but no activeProfile set
When workspace is loaded
Then first profile is used as active (or "default" if exists)
```

## 5. Implementation Plan

### Block 1: Schema & Types Extension

**Vertical slice:** Schema + types + validation tests

- Update `schema.ts`: add `activeProfile`, extend `profileSchema`
- Update `types.ts`: extend `ProfileConfig`, add `activeProfile` to `WorkspaceConfig`
- Update/add tests for new schema fields

**Files:**
- `src/workspace/config/schema.ts`
- `src/workspace/config/types.ts`
- `src/workspace/config/__tests__/schema.test.ts`

**Acceptance criteria covered:** None (foundation)

### Block 2: Profile Resolver

**Vertical slice:** Resolution logic + tests

- Create `src/workspace/profiles/resolver.ts`
- Implement `resolveProfile()`, `getActiveProfileName()`, `listProfiles()`
- Create comprehensive tests for all merge scenarios

**Files:**
- `src/workspace/profiles/resolver.ts`
- `src/workspace/profiles/__tests__/resolver.test.ts`

**Acceptance criteria covered:** #5, #6, #7, #9

### Block 3: REPL Commands

**Vertical slice:** Commands + state integration + tests

- Create `src/workspace/profiles/commands.ts`
- Implement `profile list`, `profile use <name>`, `profile show`
- Update state.ts to include activeProfile and workspaceConfig
- Register commands in REPL
- Create tests

**Files:**
- `src/workspace/profiles/commands.ts`
- `src/workspace/profiles/__tests__/commands.test.ts`
- `src/repl/state.ts`
- `src/repl/commands.ts`

**Acceptance criteria covered:** #1, #2, #3, #4, #8

## 6. Test Strategy

### Unit Tests

| Scenario | Test File |
|----------|-----------|
| Schema validation | `config/__tests__/schema.test.ts` |
| Profile resolution | `profiles/__tests__/resolver.test.ts` |
| Command handlers | `profiles/__tests__/commands.test.ts` |

### Test Data

```yaml
# Test workspace with profiles
version: 1
name: test-api
baseUrl: https://api.example.com
activeProfile: dev
profiles:
  dev:
    baseUrl: https://dev.api.example.com
    headers:
      X-Env: development
    timeoutMs: 60000
    vars:
      env: dev
  prod:
    headers:
      X-Env: production
    verifyTls: true
vars:
  tenantId: demo
```

---

## Definition of Done

- [x] Schema updated with activeProfile and extended profile fields
- [x] ProfileConfig type extended with optional overrides
- [x] resolveProfile() correctly merges workspace + profile
- [x] REPL commands work: profile list, profile use, profile show
- [x] All BDD scenarios have passing tests (37 tests)
- [x] Lint/typecheck pass
- [x] Documentation updated
