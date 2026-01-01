---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Run Command (Task 5.3)

## 1. User Stories

### US1: Execute Saved Request
**AS A** developer using unireq CLI
**I WANT** to execute a saved request from my collections
**SO THAT** I can replay API requests without re-typing them

**ACCEPTANCE:** `run smoke/health` executes the request and displays response

### US2: Find Request by Path
**AS A** developer with multiple collections
**I WANT** to specify requests using `collection/item` syntax
**SO THAT** I can quickly identify which request to run

**ACCEPTANCE:** `run <collection-id>/<item-id>` finds and executes the correct item

### US3: Helpful Error Messages
**AS A** developer debugging issues
**I WANT** clear error messages when a request isn't found
**SO THAT** I can quickly fix typos or missing definitions

**ACCEPTANCE:** Not-found errors include the attempted ID and available options

---

## 2. Business Rules

### Invariants
- Workspace must be loaded to run collections
- Collection ID and item ID must be provided
- Request method must be valid HTTP method

### Preconditions
- REPL state must have workspace path set
- collections.yaml must be loadable (or returns empty)

### Effects
- HTTP request is executed via existing executor
- Response is displayed using existing output formatting
- No state changes to collections or workspace

### Errors
- `NoWorkspaceError`: No workspace loaded in REPL state
- `CollectionNotFoundError`: Specified collection ID doesn't exist
- `ItemNotFoundError`: Specified item ID doesn't exist in collection
- `InvalidSyntaxError`: Argument format is wrong

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Collections | `findItem()` function | Unit tests |
| Collections | `runHandler` command | Integration tests |
| REPL | Register `run` command | REPL tests |
| Executor | Transform SavedRequest→ParsedRequest | Unit tests |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Execute valid request
```gherkin
Given a workspace with collections.yaml containing "smoke/health" item
And the REPL is running with workspace loaded
When user types "run smoke/health"
Then the HTTP request is executed
And the response is displayed
```

### Scenario 2: Missing workspace
```gherkin
Given no workspace is loaded
When user types "run smoke/health"
Then error message "No workspace loaded" is shown
And guidance "Run from a directory with .unireq/" is provided
```

### Scenario 3: Collection not found
```gherkin
Given a workspace with collections
And no collection named "nonexistent"
When user types "run nonexistent/health"
Then error "Collection not found: nonexistent" is shown
And available collections are listed
```

### Scenario 4: Item not found
```gherkin
Given a workspace with collection "smoke"
And no item named "nonexistent" in "smoke"
When user types "run smoke/nonexistent"
Then error "Item not found: nonexistent in collection: smoke" is shown
And available items in "smoke" are listed
```

### Scenario 5: Invalid syntax - no arguments
```gherkin
Given a workspace with collections
When user types "run"
Then usage help "Usage: run <collection>/<item>" is shown
```

### Scenario 6: Invalid syntax - missing item
```gherkin
Given a workspace with collections
When user types "run smoke"
Then usage help "Usage: run <collection>/<item>" is shown
And hint "Use 'run smoke/<item>' format" is provided
```

### Scenario 7: Request with headers and body
```gherkin
Given a collection item with headers ["Authorization: Bearer token"] and body '{"name":"test"}'
When user types "run api/create-user"
Then the request includes the Authorization header
And the request body contains the JSON
```

### Scenario 8: Request with query parameters
```gherkin
Given a collection item with query ["limit=10", "offset=0"]
When user types "run api/list-users"
Then the request includes query parameters in the URL
```

### Scenario 9: Empty collections
```gherkin
Given a workspace without collections.yaml
When user types "run smoke/health"
Then error "Collection not found: smoke" is shown
And message "No collections defined" is provided
```

### Scenario 10: Successful GET request display
```gherkin
Given a collection item with method GET and path /health
When user types "run smoke/health"
And the server responds with 200 OK
Then the response status is displayed
And response body is formatted
```

---

## 5. Implementation Plan

### Block 1: Run Command (Vertical Slice)

**Files:**
- `src/collections/runner.ts` - Request execution logic
- `src/collections/commands.ts` - REPL command handler
- `src/collections/__tests__/runner.test.ts` - Unit tests
- `src/collections/__tests__/commands.test.ts` - Integration tests

**Deliverables:**
- `parseRunArgs(args: string[])` - Parse "collection/item" syntax
- `findCollectionItem(config, collectionId, itemId)` - Find item
- `savedRequestToParsedRequest(saved, baseUrl?)` - Transform for executor
- `runHandler` - REPL command handler
- `createRunCommand()` - Command factory
- Register command in `repl/commands.ts`
- 15+ tests covering all scenarios

**Acceptance criteria covered:** #1-#10

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Valid request execution | Yes | Yes |
| No workspace | - | Yes |
| Collection not found | Yes | Yes |
| Item not found | Yes | Yes |
| Invalid syntax | Yes | Yes |
| Headers/body transform | Yes | - |
| Query params transform | Yes | - |
| Empty collections | - | Yes |

### Test Data Strategy
- Mock collections for unit tests
- Temporary workspace fixtures for integration tests
- Mock HTTP client for execution tests (no actual network)

---

## Definition of Done

- [x] ✅ `parseRunArgs()` function implemented
- [x] ✅ `findCollectionItem()` function implemented
- [x] ✅ `savedRequestToParsedRequest()` transform implemented
- [x] ✅ `runHandler` command handler implemented
- [x] ✅ Command registered in REPL
- [x] ✅ All 10 BDD scenarios have passing tests (82 total)
- [x] ✅ Lint/typecheck pass
- [x] ✅ TODO_COLLECTIONS.md updated

**Status:** ✅ DONE (2026-01-01)
