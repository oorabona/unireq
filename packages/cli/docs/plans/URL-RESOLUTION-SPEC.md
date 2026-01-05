---
doc-meta:
  status: draft
  scope: cli-core
  type: specification
  created: 2026-01-05
  updated: 2026-01-05
---

# Specification: URL Resolution & Enhanced Status Header

## 1. User Stories

### US-1: Full URL Display in Header

**AS A** developer exploring an API
**I WANT** to see the complete target URL (baseUrl + path) in the status header
**SO THAT** I know exactly where my requests will go

**ACCEPTANCE:** Header shows `[workspace:profile] https://api.com/users` format

### US-2: Implicit URL Resolution

**AS A** developer navigating an API
**I WANT** to run `get` without specifying a URL
**SO THAT** requests go to my current navigation path automatically

**ACCEPTANCE:** `get` with no URL uses `baseUrl + currentPath`

### US-3: Relative Path Resolution

**AS A** developer drilling into resources
**I WANT** to run `get 123` to append to my current path
**SO THAT** I can navigate like a filesystem

**ACCEPTANCE:** `get 123` at `/users` becomes `baseUrl/users/123`

### US-4: Absolute Path Resolution

**AS A** developer switching contexts
**I WANT** to run `get /orders` to jump to a different path
**SO THAT** I can quickly access any endpoint from baseUrl

**ACCEPTANCE:** `get /orders` at `/users` becomes `baseUrl/orders`

---

## 2. BDD Scenarios

### S-1: Header displays full URL with workspace and profile

```gherkin
Given a workspace "my-api" with profile "prod" is active
And the profile has baseUrl "https://api.example.com"
And currentPath is "/users"
When the StatusLine renders
Then it displays "[my-api:prod] https://api.example.com/users"
```

### S-2: Header displays minimal info without workspace

```gherkin
Given no workspace is active
And currentPath is "/users"
When the StatusLine renders
Then it displays "unireq /users"
And no baseUrl is shown
```

### S-3: GET without URL uses baseUrl + currentPath

```gherkin
Given profile baseUrl is "https://api.example.com"
And currentPath is "/users"
When user executes "get"
Then request is made to "https://api.example.com/users"
```

### S-4: GET with relative segment appends to currentPath

```gherkin
Given profile baseUrl is "https://api.example.com"
And currentPath is "/users"
When user executes "get 123"
Then request is made to "https://api.example.com/users/123"
```

### S-5: GET with absolute path replaces currentPath

```gherkin
Given profile baseUrl is "https://api.example.com"
And currentPath is "/users"
When user executes "get /orders"
Then request is made to "https://api.example.com/orders"
```

### S-6: GET with explicit URL ignores baseUrl

```gherkin
Given profile baseUrl is "https://api.example.com"
And currentPath is "/users"
When user executes "get https://other.com/foo"
Then request is made to "https://other.com/foo"
```

### S-7: Error when no URL and no baseUrl

```gherkin
Given no workspace is active
And currentPath is "/users"
When user executes "get"
Then an error is thrown with message containing "No base URL"
And the error suggests providing an explicit URL
```

### S-8: Error when relative path and no baseUrl

```gherkin
Given no workspace is active
When user executes "get /users"
Then an error is thrown with message containing "No base URL"
```

### S-9: URL normalization prevents double slashes

```gherkin
Given profile baseUrl is "https://api.example.com/"
And currentPath is "/users/"
When user executes "get /orders"
Then request is made to "https://api.example.com/orders"
And there are no double slashes in the URL
```

### S-10: Relative segment with nested path

```gherkin
Given profile baseUrl is "https://api.example.com"
And currentPath is "/users/123/posts"
When user executes "get 456"
Then request is made to "https://api.example.com/users/123/posts/456"
```

---

## 3. Technical Design

### 3.1 URL Resolver Utility

New module: `src/repl/url-resolver.ts`

```typescript
interface UrlResolutionContext {
  baseUrl?: string;      // From active profile
  currentPath: string;   // From REPL state (cd/pwd)
}

interface ResolvedUrl {
  url: string;           // Final absolute URL
  isExplicit: boolean;   // True if user provided full URL
}

function resolveUrl(
  input: string | undefined,
  context: UrlResolutionContext
): ResolvedUrl;
```

**Resolution Logic:**

1. If `input` starts with `http://` or `https://` → return as-is (explicit)
2. If `input` is undefined or empty:
   - If no `baseUrl` → throw error
   - Return `baseUrl + currentPath`
3. If `input` starts with `/`:
   - If no `baseUrl` → throw error
   - Return `baseUrl + input` (absolute from base)
4. Else (relative segment):
   - If no `baseUrl` → throw error
   - Return `baseUrl + currentPath + "/" + input`

### 3.2 URL Normalization

```typescript
function normalizeUrl(url: string): string;
```

- Remove trailing slashes from baseUrl
- Ensure single leading slash on paths
- Collapse `//` to `/` (except in protocol)
- Handle edge cases: empty path, root path

### 3.3 StatusLine Props Enhancement

```typescript
interface StatusLineProps {
  workspaceName?: string;
  activeProfile?: string;
  baseUrl?: string;        // NEW
  currentPath: string;
  authStatus?: 'authenticated' | 'unauthenticated' | 'none';
  lastResponse?: { status: number; statusText: string; timing: number };
}
```

### 3.4 State Updates

`ReplState` needs to track:
- `baseUrl` from active profile (already available via `workspaceConfig.profiles[activeProfile].baseUrl`)

---

## 4. Implementation Plan

### Block 1: URL Resolver Utility (Vertical Slice)

**Files:**
- `src/repl/url-resolver.ts` - Core resolution logic
- `src/repl/__tests__/url-resolver.test.ts` - Unit tests

**Tests:** S-3 to S-10 logic (unit level)

**Deliverable:** Pure function with no side effects, fully tested

### Block 2: StatusLine Enhancement (Vertical Slice)

**Files:**
- `src/ui/components/StatusLine.tsx` - Add baseUrl display
- `src/ui/components/__tests__/StatusLine.test.tsx` - Update tests

**Tests:** S-1, S-2

**Deliverable:** Header shows `[workspace:profile] fullUrl` format

### Block 3: HTTP Command Integration (Vertical Slice)

**Files:**
- `src/repl/http-commands.ts` - Use resolveUrl before parseHttpCommand
- `src/shared/http-options.ts` - Update parseHttpCommand to accept optional URL
- `src/repl/__tests__/http-commands.test.ts` - Integration tests

**Tests:** S-3 to S-10 (integration level)

**Deliverable:** HTTP commands resolve URLs via context

### Block 4: App Wiring (Final Integration)

**Files:**
- `src/ui/App.tsx` - Pass baseUrl to StatusLine
- `src/ui/hooks/useCommand.ts` - Provide context for URL resolution

**Tests:** Full E2E verification

**Deliverable:** Complete feature working end-to-end

---

## 5. Test Requirements

### Unit Tests (url-resolver.ts)
- Explicit URL passthrough
- Implicit URL (no input) resolution
- Relative segment resolution
- Absolute path resolution
- Error cases (no baseUrl)
- URL normalization (double slashes, trailing slashes)

### Component Tests (StatusLine.tsx)
- Full URL display with workspace/profile
- Minimal display without workspace
- Auth status integration
- Last response display

### Integration Tests (http-commands.ts)
- GET with no URL
- GET with relative segment
- GET with absolute path
- GET with explicit URL
- Error messages for missing baseUrl

---

## 6. Error Messages

| Situation | Message |
|-----------|---------|
| No URL, no baseUrl | "No base URL configured. Provide an explicit URL or activate a workspace profile." |
| Relative path, no baseUrl | "Cannot resolve relative path '/users' - no base URL. Use an explicit URL like 'https://...'." |
| No active profile | "No active profile. Use 'profile use <name>' to activate one." |

---

## 7. Migration Notes

- **Breaking change:** None - explicit URLs continue to work
- **New behavior:** `get` without URL now works when profile is active
- **Deprecation:** None

---

## 8. Definition of Done

- [ ] All BDD scenarios have passing tests
- [ ] StatusLine displays full URL when workspace/profile active
- [ ] URL resolution works for all cases (implicit, relative, absolute, explicit)
- [ ] Error messages are clear and actionable
- [ ] No double slashes in resolved URLs
- [ ] Unit test coverage > 90% for url-resolver.ts
- [ ] Documentation updated (help text mentions URL resolution)
