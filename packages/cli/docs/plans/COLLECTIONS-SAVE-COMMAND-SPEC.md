---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Save Command (Task 5.2)

## 1. User Stories

### US1: Save Last Request
**AS A** developer using unireq CLI
**I WANT** to save my last executed request to a collection
**SO THAT** I can replay it later with the `run` command

**ACCEPTANCE:** `save smoke/health` after `get /health` creates entry in collections.yaml

### US2: Organize Saved Requests
**AS A** developer with multiple API workflows
**I WANT** to organize requests into named collections
**SO THAT** I can group related requests together

**ACCEPTANCE:** `save auth/login` and `save auth/logout` creates items in same collection

### US3: Update Existing Request
**AS A** developer iterating on an API call
**I WANT** to update a previously saved request
**SO THAT** I keep my collection current

**ACCEPTANCE:** `save smoke/health` when item exists updates it in place

---

## 2. Business Rules

### Invariants
- Workspace must be loaded to save requests
- A request must have been executed before save
- Collection and item IDs must follow naming rules (alphanumeric, dash, underscore)

### Preconditions
- REPL state must have `workspace` path set
- REPL state must have `lastRequest` populated
- collections.yaml must be valid YAML (or not exist)

### Effects
- New item is added to collections.yaml
- Existing item with same ID is overwritten
- Collection is created if it doesn't exist
- YAML file is formatted consistently

### Errors
- `NoWorkspaceError`: No workspace loaded
- `NoRequestToSaveError`: No request has been executed yet
- `SaveSyntaxError`: Invalid save command syntax
- `InvalidIdError`: Collection or item ID contains invalid characters
- `CollectionWriteError`: Failed to write collections.yaml

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| REPL State | Add `lastRequest?: ParsedRequest` | Type safety |
| HTTP Commands | Store request in state after execution | Unit tests |
| Collections | `saveHandler` command handler | Integration tests |
| Collections | `saveToCollections()` writer function | Unit tests |
| Collections | `parsedRequestToSavedRequest()` transform | Unit tests |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Save valid request
```gherkin
Given a workspace is loaded
And a request "get /health" was executed
When user types "save smoke/health"
Then the request is saved to collections.yaml
And message "Saved: smoke/health" is shown
```

### Scenario 2: No request executed
```gherkin
Given a workspace is loaded
And no request has been executed
When user types "save smoke/health"
Then error "No request to save" is shown
And hint "Execute a request first" is provided
```

### Scenario 3: No workspace loaded
```gherkin
Given no workspace is loaded
When user types "save smoke/health"
Then error "No workspace loaded" is shown
And hint "Run from a directory with .unireq/" is provided
```

### Scenario 4: Create new collection
```gherkin
Given a workspace without collection "smoke"
And a request was executed
When user types "save smoke/health"
Then collection "smoke" is created
And item "health" is added to it
```

### Scenario 5: Update existing item
```gherkin
Given a workspace with collection "smoke" containing item "health"
And a new request "get /health?v=2" was executed
When user types "save smoke/health"
Then item "health" is updated with new request
And message "Updated: smoke/health" is shown
```

### Scenario 6: Invalid syntax - no arguments
```gherkin
Given a workspace is loaded
When user types "save"
Then usage help "Usage: save <collection>/<item>" is shown
```

### Scenario 7: Invalid syntax - missing item
```gherkin
Given a workspace is loaded
When user types "save smoke"
Then usage help "Usage: save <collection>/<item>" is shown
And hint "Use 'save smoke/<item>' format" is provided
```

### Scenario 8: Invalid ID characters
```gherkin
Given a workspace is loaded
And a request was executed
When user types "save smoke/health check"
Then error "Invalid item ID" is shown
And hint "Use alphanumeric, dash, underscore only" is provided
```

### Scenario 9: Save with name option
```gherkin
Given a workspace is loaded
And a request was executed
When user types "save smoke/health --name 'Health Check'"
Then item is saved with name "Health Check"
And id remains "health"
```

### Scenario 10: Request with full URL converted to path
```gherkin
Given a workspace is loaded
And a request to "https://api.example.com/health?foo=bar" was executed
When user types "save smoke/health"
Then saved request has path "/health"
And saved request has query ["foo=bar"]
```

---

## 5. Implementation Plan

### Block 1: State Tracking + Save Command (Vertical Slice)

**Files:**
- `src/repl/state.ts` - Add `lastRequest?: ParsedRequest`
- `src/repl/http-commands.ts` - Store request in state after execution
- `src/collections/saver.ts` - Save logic (parseArgs, transform, write)
- `src/collections/commands.ts` - Add saveHandler
- `src/collections/__tests__/saver.test.ts` - Unit tests
- `src/collections/__tests__/save-command.test.ts` - Integration tests

**Deliverables:**
- Modify `ReplState` to include `lastRequest`
- Modify HTTP handlers to store last request
- `parseSaveArgs(args: string[])` - Parse "collection/item" + options
- `validateId(id: string)` - Validate ID format
- `parsedRequestToSavedRequest(request, baseUrl?)` - Transform
- `saveToCollections(workspace, collectionId, item)` - Write to YAML
- `saveHandler` - REPL command handler
- `createSaveCommand()` - Command factory
- Register command in `repl/commands.ts`
- 15+ tests covering all scenarios

**Acceptance criteria covered:** #1-#10

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Valid save | Yes | Yes |
| No request executed | - | Yes |
| No workspace | - | Yes |
| Create collection | Yes | Yes |
| Update existing | Yes | Yes |
| Invalid syntax | Yes | Yes |
| Invalid ID | Yes | - |
| Name option | Yes | Yes |
| URL to path conversion | Yes | - |
| YAML formatting | Yes | - |

### Test Data Strategy
- Mock ReplState with/without lastRequest
- Temporary workspace fixtures for integration tests
- Mock file system for write tests

---

## Definition of Done

- [x] `ReplState` has `lastRequest` field
- [x] HTTP handlers store last request in state
- [x] `parseSaveArgs()` function implemented
- [x] `validateId()` function implemented
- [x] `parsedRequestToSavedRequest()` transform implemented
- [x] `saveToCollections()` writer implemented
- [x] `saveHandler` command handler implemented
- [x] Command registered in REPL
- [x] All 10 BDD scenarios have passing tests
- [x] Lint/typecheck pass
- [x] TODO_COLLECTIONS.md updated

**Status:** ✅ DONE (2026-01-01)
