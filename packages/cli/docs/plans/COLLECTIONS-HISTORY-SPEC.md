---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: History (NDJSON Log) - Task 5.6

## 1. User Stories

### US1: Automatic Command Logging
**AS A** developer using unireq CLI
**I WANT** my REPL commands to be automatically logged
**SO THAT** I can review what commands I executed

**ACCEPTANCE:** Every REPL command is appended to history with timestamp and command details

### US2: HTTP Request/Response Logging
**AS A** QA engineer debugging API issues
**I WANT** HTTP requests and responses to be logged with full details
**SO THAT** I can investigate failed requests and track API behavior

**ACCEPTANCE:** HTTP requests include method, URL, status, timing, and truncated body

### US3: History Persistence
**AS A** developer working across sessions
**I WANT** history to persist between CLI sessions
**SO THAT** I can reference past activity after restarting

**ACCEPTANCE:** History is stored in NDJSON file in workspace or global config

---

## 2. Business Rules

### Invariants
- History entries are append-only (no modification of past entries)
- Each entry is a single JSON line (NDJSON format)
- Timestamps are ISO 8601 UTC format
- Sensitive data (passwords, auth tokens) MUST be redacted

### Preconditions
- File system must be writable
- History file path must be determinable (workspace or global)

### Effects
- New entry appended to history file
- File created if it doesn't exist (with 0600 permissions)
- Old entries rotated if max entries exceeded

### Errors
- `HistoryWriteError`: Failed to write to history file (non-blocking)
- Write failures are logged as warnings, never block operations

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | `HistoryEntry`, `CmdEntry`, `HttpEntry` types | Type safety |
| History | New `history.ts` module | Unit tests |
| History | `HistoryWriter` class | Unit tests |
| REPL Engine | Call history writer after commands | Integration tests |
| Executor | Call history writer after HTTP requests | Integration tests |
| Workspace | History file path resolution | Unit tests |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Command Logging

#### Scenario 1: Log REPL command
```gherkin
Given history writer is initialized
When REPL command "cd /users" is executed
Then history file contains entry with type "cmd"
And entry has command "cd"
And entry has args ["/users"]
And entry has timestamp in ISO 8601 format
```

#### Scenario 2: Log command with special characters
```gherkin
Given history writer is initialized
When command with unicode "get /users?name=日本語" is executed
Then history file contains entry with preserved unicode
```

### HTTP Request Logging

#### Scenario 3: Log successful HTTP request
```gherkin
Given history writer is initialized
When GET request to "https://api.example.com/users" returns 200
Then history file contains entry with type "http"
And entry has method "GET"
And entry has url "https://api.example.com/users"
And entry has status 200
And entry has durationMs > 0
```

#### Scenario 4: Log HTTP request with response body
```gherkin
Given history writer is initialized
When GET request returns body {"id": 1, "name": "Alice"}
Then history entry contains responseBody with JSON content
And responseBody is truncated if > 10KB
```

#### Scenario 5: Log HTTP request with large body
```gherkin
Given history writer is initialized
When response body exceeds 10KB
Then history entry responseBody is truncated
And entry has responseBodyTruncated = true
```

#### Scenario 6: Log failed HTTP request
```gherkin
Given history writer is initialized
When HTTP request fails with network error
Then history entry has status = null
And entry has error message
```

### Sensitive Data Redaction

#### Scenario 7: Redact authorization header
```gherkin
Given request has header "Authorization: Bearer secret123"
When request is logged to history
Then history entry shows "Authorization: [REDACTED]"
```

#### Scenario 8: Redact password in body
```gherkin
Given request body contains {"password": "secret"}
When request is logged to history
Then history entry shows password as "[REDACTED]"
```

### File Management

#### Scenario 9: Create history file if not exists
```gherkin
Given history file does not exist
When first command is logged
Then history file is created
And file has permissions 0600
```

#### Scenario 10: Append to existing history
```gherkin
Given history file has 5 entries
When new command is logged
Then history file has 6 entries
And previous entries are preserved
```

#### Scenario 11: Rotate history when max exceeded
```gherkin
Given history has 10000 entries (max)
When new entry is logged
Then oldest 2000 entries are removed
And newest 8000 entries are kept
And new entry is appended
```

### Error Handling

#### Scenario 12: Handle write failure gracefully
```gherkin
Given history file is not writable
When command is executed
Then warning is logged
And command execution continues normally
And no error is thrown to user
```

### Storage Location

#### Scenario 13: Use workspace history when available
```gherkin
Given workspace exists at /project/.unireq/
When command is logged
Then history is written to /project/.unireq/history.ndjson
```

#### Scenario 14: Use global history when no workspace
```gherkin
Given no workspace is detected
When command is logged
Then history is written to ~/.config/unireq/history.ndjson
```

### Assertion/Extraction Results

#### Scenario 15: Log assertion results
```gherkin
Given request has assertions configured
When request is executed with 3 assertions (2 pass, 1 fail)
Then history entry has assertionsPassed = 2
And entry has assertionsFailed = 1
```

#### Scenario 16: Log extraction results
```gherkin
Given request has extract config for vars ["userId", "token"]
When variables are extracted
Then history entry has extractedVars = ["userId", "token"]
And actual values are NOT logged
```

---

## 5. Implementation Plan

### Block 1: History Types and Writer Core

**Package:** `@unireq/cli`

**Files:**
- `src/collections/history/types.ts` - Entry types
- `src/collections/history/writer.ts` - HistoryWriter class
- `src/collections/history/__tests__/writer.test.ts` - Unit tests

**Deliverables:**
- `HistoryEntry` base type with timestamp
- `CmdEntry` for REPL commands
- `HttpEntry` for HTTP requests
- `HistoryWriter.logCmd()` method
- `HistoryWriter.logHttp()` method
- File creation with proper permissions
- NDJSON append logic

**Acceptance criteria covered:** #1, #2, #3, #4, #9, #10

**Complexity:** M
**Dependencies:** None

### Block 2: Redaction and Truncation

**Package:** `@unireq/cli`

**Files:**
- `src/collections/history/redactor.ts` - Sensitive data redaction
- `src/collections/history/__tests__/redactor.test.ts` - Unit tests
- Update `writer.ts` to use redactor

**Deliverables:**
- `redactHeaders()` function
- `redactBody()` function
- `truncateBody()` function (10KB limit)
- Integration with HistoryWriter

**Acceptance criteria covered:** #5, #7, #8

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Rotation

**Package:** `@unireq/cli`

**Files:**
- `src/collections/history/rotation.ts` - Rotation logic
- `src/collections/history/__tests__/rotation.test.ts` - Unit tests
- Update `writer.ts` to use rotation

**Deliverables:**
- `countEntries()` function
- `rotateHistory()` function (keep 80%)
- Trigger rotation when max (10000) exceeded

**Acceptance criteria covered:** #11

**Complexity:** S
**Dependencies:** Block 1

### Block 4: Integration with REPL and Executor

**Package:** `@unireq/cli`

**Files:**
- `src/repl/state.ts` - Add history writer to state
- `src/repl/engine.ts` - Log commands after execution
- `src/executor.ts` - Log HTTP requests after execution
- `src/collections/commands.ts` - Log with assertion/extraction results
- `src/collections/history/__tests__/integration.test.ts` - Integration tests

**Deliverables:**
- Add `historyWriter` to ReplState
- Initialize writer on REPL start
- Log commands in REPL engine
- Log HTTP requests in executor
- Include assertion/extraction results

**Acceptance criteria covered:** #6, #12, #13, #14, #15, #16

**Complexity:** M
**Dependencies:** Blocks 1, 2, 3

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Log REPL command | Yes | Yes |
| Log command with unicode | Yes | - |
| Log successful HTTP | Yes | Yes |
| Log HTTP with body | Yes | - |
| Log HTTP large body | Yes | - |
| Log failed HTTP | Yes | - |
| Redact auth header | Yes | - |
| Redact password in body | Yes | - |
| Create history file | Yes | Yes |
| Append to history | Yes | - |
| Rotate history | Yes | - |
| Handle write failure | Yes | - |
| Workspace history | Yes | Yes |
| Global history | Yes | - |
| Log assertion results | Yes | Yes |
| Log extraction results | Yes | Yes |

### Test Data Strategy
- Temporary directories for file tests
- Mock filesystem for error cases
- Sample NDJSON entries for parsing tests
- Various body sizes for truncation tests
- Sensitive data patterns for redaction tests

---

## Definition of Done

- [ ] `history/types.ts` with entry types
- [ ] `history/writer.ts` with HistoryWriter class
- [ ] `history/redactor.ts` for sensitive data
- [ ] `history/rotation.ts` for file rotation
- [ ] REPL engine logs commands
- [ ] Executor logs HTTP requests
- [ ] Collections commands log assertions/extractions
- [ ] All 16 BDD scenarios have passing tests
- [ ] Lint/typecheck pass
- [ ] TODO_COLLECTIONS.md updated

**Status:** DRAFT
