---
doc-meta:
  status: draft
  scope: output
  type: specification
  created: 2026-01-04
---

# Specification: Output Polish Tasks

## Tasks

### B: Terminal Width Detection ✅

**User Story:** As a CLI user, I want output to respect my terminal width so that content is readable.

**Status:** DONE (2026-01-04)

**Acceptance Criteria:**
- [x] `getTerminalWidth()` returns `process.stdout.columns` when TTY
- [x] Returns 80 when not TTY or undefined
- [x] Exported from colors.ts
- [x] 4 tests (columns available, undefined, custom default, zero)

**Implementation:**
```typescript
export function getTerminalWidth(defaultWidth = 80): number {
  return process.stdout.columns || defaultWidth;
}
```

**Tests:**
- Returns columns when TTY
- Returns default when not TTY
- Respects custom default

---

### C: HAR Export Format ✅

**User Story:** As a developer, I want to export requests as HAR format so I can import them into browser dev tools.

**Status:** DONE (2026-01-04)

**Acceptance Criteria:**
- [x] `toHar(request, response)` returns valid HAR 1.2 JSON
- [x] Includes `log.entries[0].request` and `log.entries[0].response`
- [x] Exported from export.ts
- [x] Added to ExportFormat type
- [x] 13 tests (basic structure, request details, response details, URL handling)

**HAR 1.2 Minimal Structure:**
```json
{
  "log": {
    "version": "1.2",
    "creator": { "name": "unireq", "version": "0.0.1" },
    "entries": [{
      "startedDateTime": "2026-01-04T12:00:00.000Z",
      "time": 100,
      "request": {
        "method": "GET",
        "url": "https://api.example.com/users",
        "httpVersion": "HTTP/1.1",
        "headers": [{ "name": "Content-Type", "value": "application/json" }],
        "queryString": [{ "name": "limit", "value": "10" }],
        "bodySize": 0
      },
      "response": {
        "status": 200,
        "statusText": "OK",
        "httpVersion": "HTTP/1.1",
        "headers": [{ "name": "Content-Type", "value": "application/json" }],
        "content": { "size": 123, "mimeType": "application/json", "text": "{}" },
        "bodySize": 123
      }
    }]
  }
}
```

**Tests:**
- Generates valid HAR structure
- Includes request details
- Includes response details
- Handles empty body
- Handles query params
- Handles headers

---

## D: Secrets F-001 Migrate Handlers ✅

**User Story:** As a maintainer, I want handlers to use the unified backend API so code is consistent.

**Status:** DONE (2026-01-04)

**Acceptance Criteria:**
- [x] handleSet uses ensureBackendReady instead of ensureVaultUnlocked
- [x] handleGet uses ensureBackendReady
- [x] handleList uses ensureBackendReady
- [x] handleDelete uses ensureBackendReady
- [x] ensureVaultUnlocked function removed
- [x] All existing tests pass (30 tests)

**Implementation:**
Replace:
```typescript
if (!(await ensureVaultUnlocked(state)) || !state.vault) {
  return;
}
const vault = state.vault;
vault.get(name);
```

With:
```typescript
const backend = await ensureBackendReady(state as SecretState);
if (!backend) {
  return;
}
await backend.get(name);
```

---

## Implementation Order

1. **D: Secrets refactor** ✅ DONE
2. **B: Terminal width** ✅ DONE
3. **C: HAR export** ✅ DONE

---

## Summary

All tasks completed on 2026-01-04:
- Task D: Secrets handlers migrated to unified backend API (30 tests)
- Task B: Terminal width detection added to colors.ts (4 tests)
- Task C: HAR 1.2 export format added to export.ts (13 tests)
