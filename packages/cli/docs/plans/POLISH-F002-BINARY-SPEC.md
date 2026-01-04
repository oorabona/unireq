---
doc-meta:
  status: draft
  scope: secrets,output
  type: specification
  created: 2026-01-04
---

# Specification: F-002 Config Wiring + Binary Content Detection

## Overview

Two small polish tasks:
1. **F-002**: Wire workspace `secretsBackend` config to backend resolver
2. **Binary Detection**: Detect and handle binary response content

---

## Task 1: F-002 — Wire Workspace Config to Resolver

### User Story

As a CLI user, I want my workspace's `secretsBackend` configuration to be respected so the resolver uses the backend I configured.

### Current State

```typescript
// commands.ts:40-46
function getResolver(state: SecretState): SecretBackendResolver {
  if (!state.secretBackendResolver) {
    // TODO: Get backend config from workspace config when available
    state.secretBackendResolver = createBackendResolver();
  }
  return state.secretBackendResolver;
}
```

### Target State

```typescript
function getResolver(state: SecretState): SecretBackendResolver {
  if (!state.secretBackendResolver) {
    const config = getWorkspaceSecretsBackendConfig(state);
    state.secretBackendResolver = createBackendResolver(config);
  }
  return state.secretBackendResolver;
}

function getWorkspaceSecretsBackendConfig(state: SecretState): Partial<SecretResolverConfig> | undefined {
  // Access workspaceConfig.secretsBackend if available
  const workspaceConfig = (state as { workspaceConfig?: { secretsBackend?: { backend?: string } } }).workspaceConfig;
  if (!workspaceConfig?.secretsBackend?.backend) {
    return undefined;
  }
  return { backend: workspaceConfig.secretsBackend.backend as 'auto' | 'keychain' | 'vault' };
}
```

### BDD Scenarios

#### S-1: Workspace config specifies vault backend
```gherkin
Given a workspace with secretsBackend.backend = 'vault'
When the user runs a secret command
Then the resolver should use vault backend
And keychain should NOT be attempted
```

#### S-2: Workspace config specifies keychain backend
```gherkin
Given a workspace with secretsBackend.backend = 'keychain'
When the user runs a secret command
Then the resolver should use keychain backend
And throw KeychainUnavailableError if keychain not available
```

#### S-3: No workspace config (default auto)
```gherkin
Given no workspace config
When the user runs a secret command
Then the resolver should use auto mode (default)
And try keychain first, fallback to vault
```

### Test Requirements

| Test | Description |
|------|-------------|
| T-1 | getResolver reads secretsBackend.backend = 'vault' from workspaceConfig |
| T-2 | getResolver reads secretsBackend.backend = 'keychain' from workspaceConfig |
| T-3 | getResolver uses default 'auto' when no workspaceConfig |

---

## Task 2: Binary Content Detection

### User Story

As a CLI user, I want the formatter to detect binary responses and display a placeholder instead of garbled output.

### Current State

```typescript
// formatter.ts - formatBody assumes all data is text
function formatBody(data: unknown, contentType: string | undefined, useColors: boolean): string {
  // No binary detection - always tries to format as text
}
```

### Target State

```typescript
// New: binary.ts
export function isBinaryContentType(contentType: string | undefined): boolean;
export function isBinaryData(data: unknown): boolean;
export function formatBinaryPlaceholder(size: number, contentType: string | undefined): string;

// formatter.ts - check binary before formatting
function formatBody(data: unknown, contentType: string | undefined, useColors: boolean): string {
  if (isBinaryContentType(contentType) || isBinaryData(data)) {
    const size = calculateSize(data);
    return formatBinaryPlaceholder(size, contentType);
  }
  // ... existing formatting
}
```

### Binary Content Types

```typescript
const BINARY_CONTENT_TYPES = [
  // Images
  'image/', // image/png, image/jpeg, image/gif, image/webp, image/svg+xml excluded
  // Audio/Video
  'audio/',
  'video/',
  // Archives
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  // Binary formats
  'application/octet-stream',
  'application/pdf',
  'application/msword',
  'application/vnd.', // Office documents
  // Executables
  'application/x-executable',
  'application/x-mach-binary',
  'application/x-dosexec',
];

const TEXT_SUBTYPES = ['svg+xml', 'xml', 'json', 'javascript', 'html', 'css', 'text'];
```

### Binary Data Detection

```typescript
function isBinaryData(data: unknown): boolean {
  if (typeof data !== 'string') {
    // Buffer or object - check for Buffer with binary content
    if (Buffer.isBuffer(data)) {
      return containsBinaryBytes(data);
    }
    return false; // Objects are JSON, not binary
  }

  // String - check for null bytes or high ratio of non-printable chars
  return containsBinaryChars(data);
}

function containsBinaryChars(str: string): boolean {
  // Null byte is definitive binary indicator
  if (str.includes('\0')) return true;

  // High ratio of non-printable chars indicates binary
  const nonPrintable = str.split('').filter(c => {
    const code = c.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  }).length;

  return nonPrintable / str.length > 0.1; // >10% non-printable
}
```

### Placeholder Format

```
[Binary data: 1.5 KB, image/png]
[Binary data: 234 bytes, application/octet-stream]
[Binary data: 5.2 MB, video/mp4]
```

### BDD Scenarios

#### S-4: Binary content type detected
```gherkin
Given a response with Content-Type: image/png
When formatting the response body
Then display "[Binary data: X KB, image/png]"
And do NOT attempt to parse/display content
```

#### S-5: Binary data detected by content
```gherkin
Given a response with Content-Type: application/octet-stream
And body contains null bytes
When formatting the response body
Then display "[Binary data: X bytes, application/octet-stream]"
```

#### S-6: Text content type passes through
```gherkin
Given a response with Content-Type: application/json
When formatting the response body
Then format normally (not as binary)
```

#### S-7: SVG is NOT binary
```gherkin
Given a response with Content-Type: image/svg+xml
When formatting the response body
Then format normally as text (SVG is XML)
```

### Test Requirements

| Test | Description |
|------|-------------|
| T-4 | isBinaryContentType returns true for image/png |
| T-5 | isBinaryContentType returns true for application/octet-stream |
| T-6 | isBinaryContentType returns false for application/json |
| T-7 | isBinaryContentType returns false for image/svg+xml |
| T-8 | isBinaryData returns true for string with null bytes |
| T-9 | isBinaryData returns false for normal JSON string |
| T-10 | formatBinaryPlaceholder formats size and type correctly |
| T-11 | formatBody returns placeholder for binary content type |
| T-12 | formatBody returns placeholder for binary data |
| T-13 | formatJson includes isBinary flag for binary content |

---

## Implementation Plan

### Block 1: F-002 Config Wiring (SECRETS scope)

**Files:**
- `src/secrets/commands.ts` — Wire config to resolver

**Changes:**
1. Add helper to extract secretsBackend config from state
2. Pass config to createBackendResolver()
3. Remove TODO comment

**Tests:**
- `src/secrets/__tests__/commands.test.ts` — 3 new tests

### Block 2: Binary Detection Module (OUTPUT scope)

**Files:**
- `src/output/binary.ts` — NEW: Detection utilities
- `src/output/__tests__/binary.test.ts` — NEW: Tests

**Exports:**
- `isBinaryContentType(contentType: string | undefined): boolean`
- `isBinaryData(data: unknown): boolean`
- `formatBinaryPlaceholder(size: number, contentType: string | undefined): string`

**Tests:** 7 tests (T-4 to T-10)

### Block 3: Formatter Integration (OUTPUT scope)

**Files:**
- `src/output/formatter.ts` — Integrate binary detection
- `src/output/__tests__/formatter.test.ts` — NEW or update

**Changes:**
1. Import binary detection functions
2. Check binary before formatting body
3. Return placeholder for binary content

**Tests:** 3 tests (T-11 to T-13)

---

## Acceptance Checklist

- [ ] F-002: getResolver uses workspace secretsBackend config
- [ ] F-002: 3 tests pass
- [ ] Binary: isBinaryContentType detects binary types
- [ ] Binary: isBinaryData detects binary content
- [ ] Binary: formatBinaryPlaceholder shows size and type
- [ ] Binary: formatBody returns placeholder for binary
- [ ] Binary: 10 tests pass
- [ ] All existing tests pass (107 output tests)
