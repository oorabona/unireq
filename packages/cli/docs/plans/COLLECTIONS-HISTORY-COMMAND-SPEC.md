---
doc-meta:
  status: draft
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: History Command - Task 5.7

## 1. User Stories

### US1: Browse Recent History
**AS A** developer using unireq CLI
**I WANT** to see my recent commands and requests
**SO THAT** I can review what I've done in this session

**ACCEPTANCE:** Running `history` shows last 20 entries with timestamps

### US2: Search History
**AS A** developer debugging an API issue
**I WANT** to search my history for specific URLs or commands
**SO THAT** I can find relevant past requests quickly

**ACCEPTANCE:** Running `history search <term>` filters entries by URL, method, or command

### US3: View Entry Details
**AS A** developer investigating a past request
**I WANT** to see full details of a specific history entry
**SO THAT** I can examine headers, body, and response

**ACCEPTANCE:** Running `history show <index>` displays complete entry details

## 2. Business Rules

### Entry Display Format

**Command entries:**
```
[N] 2026-01-01 12:34:56 CMD: <command> <args...> [SUCCESS|FAILED]
```

**HTTP entries:**
```
[N] 2026-01-01 12:34:56 HTTP: <METHOD> <url> → <status> (<duration>ms)
```

### Indexing

- Entries are numbered from most recent (0) to oldest (N-1)
- Index 0 is always the most recent entry
- Negative indices not supported

### Search Behavior

- Case-insensitive matching
- Matches against: URL, method, command name
- Partial matches supported (substring)

### Constraints

- Default list count: 20
- Maximum list count: 1000 (prevent accidental full dump)
- Stream-read to handle large files efficiently

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| History Module | Add `HistoryReader` class | Unit tests for parsing |
| REPL Commands | Add `historyHandler` | Integration tests |
| Types | No changes needed | Reuse existing types |

### New Files

- `packages/cli/src/collections/history/reader.ts` - HistoryReader class
- `packages/cli/src/collections/history/__tests__/reader.test.ts` - Reader tests

### Modified Files

- `packages/cli/src/collections/commands.ts` - Add history handler
- `packages/cli/src/collections/history/index.ts` - Export reader

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: List recent history (nominal)
```gherkin
Given a history file exists with 50 entries
When user runs "history"
Then last 20 entries are displayed
And entries are numbered 0-19 (most recent first)
And each entry shows timestamp, type, and summary
```

### Scenario 2: List specific count
```gherkin
Given a history file exists with 50 entries
When user runs "history list 5"
Then last 5 entries are displayed
And entries are numbered 0-4
```

### Scenario 3: Filter HTTP entries
```gherkin
Given a history file with 10 HTTP and 10 CMD entries
When user runs "history http"
Then only HTTP entries are displayed
And CMD entries are excluded
```

### Scenario 4: Filter CMD entries
```gherkin
Given a history file with 10 HTTP and 10 CMD entries
When user runs "history cmd"
Then only CMD entries are displayed
And HTTP entries are excluded
```

### Scenario 5: Show entry details
```gherkin
Given a history file with HTTP entry at index 3
When user runs "history show 3"
Then full entry details are displayed
And request headers are shown
And response status is shown
And timing is shown
```

### Scenario 6: Search history
```gherkin
Given a history file with entries containing "api.example.com"
When user runs "history search example"
Then only matching entries are displayed
And entries with "example" in URL are shown
```

### Scenario 7: Empty history
```gherkin
Given no history file exists
When user runs "history"
Then "No history yet" message is displayed
```

### Scenario 8: Search no matches
```gherkin
Given a history file with entries
When user runs "history search nonexistent"
Then "No matching entries" message is displayed
```

### Scenario 9: Index out of range
```gherkin
Given a history file with 10 entries
When user runs "history show 99"
Then "Entry not found: index 99" error is displayed
```

### Scenario 10: Malformed entry handling
```gherkin
Given a history file with some invalid JSON lines
When user runs "history"
Then valid entries are displayed
And invalid lines are silently skipped
```

## 5. Implementation Plan

### Block 1: History Reader (Vertical Slice)

**Package:** cli

**Components:**
- `HistoryReader` class with:
  - `list(count?: number, filter?: 'http' | 'cmd')` - Get recent entries
  - `show(index: number)` - Get specific entry
  - `search(term: string)` - Search entries
- Stream-based NDJSON parsing
- Error handling for malformed lines

**Tests:**
- Unit tests for HistoryReader (15 tests)
- Test list, show, search, filter
- Test edge cases (empty, malformed, large files)

**Acceptance criteria covered:** #1, #2, #3, #4, #7, #10

### Block 2: REPL Integration (Vertical Slice)

**Package:** cli

**Components:**
- `historyHandler` command handler
- Argument parsing for subcommands
- Output formatting with consola

**Tests:**
- Integration tests for history command (5 tests)
- Test full command flow

**Acceptance criteria covered:** #5, #6, #8, #9

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| List recent history | Yes | Yes |
| List specific count | Yes | - |
| Filter HTTP entries | Yes | Yes |
| Filter CMD entries | Yes | - |
| Show entry details | Yes | Yes |
| Search history | Yes | Yes |
| Empty history | Yes | - |
| Search no matches | Yes | - |
| Index out of range | Yes | - |
| Malformed entry | Yes | - |

### Test Data Strategy

- Create mock NDJSON files with various entry types
- Use temp directories for file operations
- Test with both small and larger datasets

---

## Definition of Done

- [ ] HistoryReader class implemented with all methods
- [ ] All BDD scenarios have passing tests
- [ ] History command registered in REPL
- [ ] 20+ tests covering all functionality
- [ ] Lint/typecheck pass
- [ ] Documentation updated
