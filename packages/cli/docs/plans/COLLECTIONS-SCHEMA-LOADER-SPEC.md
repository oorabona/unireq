---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Collection Schema and Loader (Task 5.1)

## 1. User Stories

### US1: Load Collection Definitions
**AS A** developer using unireq CLI
**I WANT** to load collection definitions from a YAML file
**SO THAT** I can access saved request recipes for execution

**ACCEPTANCE:** Valid `collections.yaml` loads into typed `CollectionConfig` object

### US2: Validate Collection Structure
**AS A** developer defining collections
**I WANT** schema validation with helpful error messages
**SO THAT** I can quickly fix configuration mistakes

**ACCEPTANCE:** Invalid YAML produces specific error with field path and expected format

### US3: Optional Collections
**AS A** developer in a new workspace
**I WANT** collections to be optional
**SO THAT** the CLI works without requiring collection setup

**ACCEPTANCE:** Missing `collections.yaml` returns empty list, not an error

---

## 2. Business Rules

### Invariants
- Collection IDs must be unique across the file
- Item IDs must be unique within their parent collection
- HTTP methods must be valid (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Request path is required for every item

### Preconditions
- Workspace must be detected (`.unireq/` directory exists)
- If `collections.yaml` exists, it must be valid YAML

### Effects
- Loader returns typed `CollectionConfig` with all collections and items
- Raw strings preserved (no variable interpolation at load time)
- Assert/extract structures preserved for downstream processing

### Errors
- `CollectionParseError`: Invalid YAML syntax
- `CollectionValidationError`: Schema validation failure
- `CollectionDuplicateIdError`: Duplicate collection or item ID

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | `CollectionConfig`, `Collection`, `CollectionItem`, `SavedRequest` | TypeScript compile |
| Schema | Valibot schemas for all collection structures | Unit tests |
| Loader | `loadCollections(workspacePath)` function | Integration tests |
| Errors | Custom error classes with context | Unit tests |

---

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Load valid collections file
```gherkin
Given a workspace with valid collections.yaml
When loadCollections is called
Then it returns a CollectionConfig object
And collections array contains parsed items
And each item has typed request structure
```

### Scenario 2: Handle missing collections file
```gherkin
Given a workspace without collections.yaml
When loadCollections is called
Then it returns CollectionConfig with empty collections array
And no error is thrown
```

### Scenario 3: Reject invalid YAML syntax
```gherkin
Given a collections.yaml with YAML syntax error
When loadCollections is called
Then it throws CollectionParseError
And error message includes line number
```

### Scenario 4: Reject schema validation failure
```gherkin
Given a collections.yaml with invalid method "INVALID"
When loadCollections is called
Then it throws CollectionValidationError
And error message includes field path "collections[0].items[0].request.method"
```

### Scenario 5: Reject duplicate collection IDs
```gherkin
Given a collections.yaml with two collections named "smoke"
When loadCollections is called
Then it throws CollectionDuplicateIdError
And error message includes "Duplicate collection ID: smoke"
```

### Scenario 6: Reject duplicate item IDs within collection
```gherkin
Given a collection with two items named "health"
When loadCollections is called
Then it throws CollectionDuplicateIdError
And error message includes "Duplicate item ID: health in collection: smoke"
```

### Scenario 7: Parse complete item with all fields
```gherkin
Given a collection item with method, path, headers, body, assert, extract
When parsed
Then item.request has method, path, headers array, body string
And item.assert is preserved as AssertConfig structure
And item.extract is preserved as ExtractConfig structure
```

### Scenario 8: Parse minimal item (required fields only)
```gherkin
Given a collection item with only method and path
When parsed
Then item.request has method and path
And item.description is undefined
And item.request.headers is undefined
And item.request.body is undefined
And item.assert is undefined
And item.extract is undefined
```

### Scenario 9: Handle empty collections file
```gherkin
Given a collections.yaml containing only "---"
When loadCollections is called
Then it returns CollectionConfig with empty collections array
```

### Scenario 10: Handle collections key with empty array
```gherkin
Given a collections.yaml with "collections: []"
When loadCollections is called
Then it returns CollectionConfig with empty collections array
```

### Scenario 11: Validate HTTP method values
```gherkin
Given a collection item with method "GET"
When validated
Then it passes validation

Given a collection item with method "post" (lowercase)
When validated
Then it passes validation (case-insensitive)

Given a collection item with method "INVALID"
When validated
Then it throws CollectionValidationError
```

### Scenario 12: Parse headers as array of strings
```gherkin
Given a collection item with headers:
  - "Authorization: Bearer token"
  - "Content-Type: application/json"
When parsed
Then item.request.headers is string array with 2 entries
```

---

## 5. Implementation Plan

### Block 1: Types and Schema (Vertical Slice)

**Files:**
- `src/collections/types.ts` - TypeScript interfaces
- `src/collections/schema.ts` - Valibot schemas
- `src/collections/__tests__/schema.test.ts` - Schema validation tests

**Deliverables:**
- `CollectionConfig` interface
- `Collection` interface
- `CollectionItem` interface
- `SavedRequest` interface (request structure)
- `AssertConfig` interface (assertion structure, not validated deeply)
- `ExtractConfig` interface (extraction structure, not validated deeply)
- Valibot schemas for all types
- 15+ unit tests for schema validation

**Acceptance criteria covered:** #4, #5, #7, #8, #11, #12

### Block 2: Errors and Loader (Vertical Slice)

**Files:**
- `src/collections/errors.ts` - Custom error classes
- `src/collections/loader.ts` - YAML loading and validation
- `src/collections/__tests__/loader.test.ts` - Loader integration tests
- `src/collections/index.ts` - Public exports

**Deliverables:**
- `CollectionParseError` class
- `CollectionValidationError` class
- `CollectionDuplicateIdError` class
- `loadCollections(workspacePath: string): Promise<CollectionConfig>` function
- Duplicate ID validation logic
- 12+ integration tests for loader scenarios

**Acceptance criteria covered:** #1, #2, #3, #5, #6, #9, #10

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Valid collections load | Yes | Yes |
| Missing file handled | - | Yes |
| YAML parse error | - | Yes |
| Schema validation error | Yes | Yes |
| Duplicate collection ID | Yes | Yes |
| Duplicate item ID | Yes | Yes |
| Complete item parsing | Yes | - |
| Minimal item parsing | Yes | - |
| Empty file | - | Yes |
| Method validation | Yes | - |
| Headers parsing | Yes | - |

### Test Data Strategy
- Fixtures in `src/collections/__tests__/fixtures/`
- Valid and invalid YAML samples
- Edge case collections

---

## Definition of Done

- [x] ✅ All types defined in `types.ts`
- [x] ✅ Valibot schemas in `schema.ts`
- [x] ✅ Loader function in `loader.ts`
- [x] ✅ Error classes in `errors.ts`
- [x] ✅ All 12 BDD scenarios have passing tests (44 total)
- [x] ✅ Lint/typecheck pass
- [x] ✅ Documentation updated (TODO_COLLECTIONS.md)

**Status:** ✅ COMPLETE (2026-01-01)
