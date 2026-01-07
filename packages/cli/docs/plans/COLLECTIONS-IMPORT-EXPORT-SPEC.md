---
doc-meta:
  status: canonical
  scope: collections
  type: specification
  created: 2026-01-07
  updated: 2026-01-07
---

# Specification: Collections Import/Export

**Task:** 5.8 - Collection import/export (Postman, Insomnia, HAR)

## 1. User Stories

### US1: Migrate from Postman
```
AS A developer with existing Postman collections
I WANT to import my collections into unireq
SO THAT I can use a lightweight CLI tool without losing my saved requests

ACCEPTANCE: Postman v2.1 JSON imports as unireq collections with requests, headers, body preserved
```

### US2: Migrate from Insomnia
```
AS A developer switching from Insomnia
I WANT to import my workspaces into unireq
SO THAT I can continue using my existing API definitions

ACCEPTANCE: Insomnia v4 JSON imports with requests preserved (environments/auth skipped)
```

### US3: Import from HAR Capture
```
AS A developer analyzing network traffic
I WANT to import HAR files from browser DevTools
SO THAT I can replay captured requests in the CLI

ACCEPTANCE: HAR 1.2 entries import as collection items with method, URL, headers, body
```

### US4: Export for Sharing
```
AS A developer sharing API recipes with my team
I WANT to export my collections to standard formats
SO THAT teammates can import them into their preferred tools

ACCEPTANCE: Export to Postman v2.1 JSON and HAR 1.2 formats
```

---

## 2. Business Rules

### 2.1 Invariants

| Rule | Description |
|------|-------------|
| INV-1 | Imported items must have unique IDs within their collection |
| INV-2 | All imported requests must have at least method and path |
| INV-3 | Variable syntax must be converted: `{{var}}` (Postman) → `${var}` (unireq) |
| INV-4 | Collection names must be valid filesystem-safe identifiers |
| INV-5 | Exported files must be valid according to their format spec |

### 2.2 Preconditions

| Action | Precondition |
|--------|--------------|
| Import | Valid file format (JSON for Postman/Insomnia, HAR for archive) |
| Import | File exists and is readable |
| Export | At least one collection exists in workspace |
| Export | Target directory is writable |

### 2.3 Merge Strategy (Conflict Resolution)

When importing collection that already exists:

| Flag | Behavior |
|------|----------|
| `--merge` | Add new items, skip duplicates |
| `--replace` | Replace entire collection |
| `--rename` | Create new collection with suffix |
| (none) | Interactive prompt to choose |

### 2.4 Skipped Features (Explicit Non-Goals)

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Postman environments | Different paradigm | Use unireq profiles |
| Postman globals | Different paradigm | Use workspace variables |
| Postman pre-request scripts | Against declarative philosophy | Use extract/assert |
| Postman test scripts | Against declarative philosophy | Use unireq assertions |
| Insomnia plugins | Not applicable | Use @unireq policies |
| Auth config migration | Complex mapping | Configure manually |

### 2.5 Effects

| Action | Effect |
|--------|--------|
| Import Postman | Creates/updates collections in `collections.yaml` |
| Import Insomnia | Creates/updates collections in `collections.yaml` |
| Import HAR | Creates new collection with captured requests |
| Export Postman | Generates `<name>.postman_collection.json` |
| Export HAR | Generates `<name>.har` |

### 2.6 Error Handling

| Error | Response |
|-------|----------|
| Invalid JSON | `ImportParseError: Invalid JSON at line X` |
| Unsupported format version | `ImportVersionError: Expected v2.1, got v2.0` |
| Missing required field | `ImportValidationError: Missing 'method' in item 'X'` |
| Write permission denied | `ExportWriteError: Cannot write to X` |
| Empty collection | Warning only, proceed with import |

---

## 3. Technical Impact

### 3.1 Layer Changes

| Layer | Changes | Validation |
|-------|---------|------------|
| Types | Add import/export types | Type safety, no any |
| Importers | Postman, Insomnia, HAR parsers | Schema validation |
| Exporters | Postman, HAR generators | Output validation |
| Commands | `import`, `export` REPL commands | Argument parsing |
| Tests | Unit + integration tests | Full coverage |

### 3.2 File Structure

```
packages/cli/src/collections/
├── types.ts                    # Existing + import/export types
├── import/
│   ├── index.ts                # Import orchestrator
│   ├── postman.ts              # Postman v2.1 importer
│   ├── insomnia.ts             # Insomnia v4 importer
│   ├── har.ts                  # HAR 1.2 importer
│   └── __tests__/
│       ├── postman.test.ts
│       ├── insomnia.test.ts
│       └── har.test.ts
├── export/
│   ├── index.ts                # Export orchestrator
│   ├── postman.ts              # Postman v2.1 exporter
│   ├── har.ts                  # HAR 1.2 exporter
│   └── __tests__/
│       ├── postman.test.ts
│       └── har.test.ts
├── commands.ts                 # Add import/export handlers
└── merge.ts                    # Merge strategy implementation
```

### 3.3 Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Valibot | Schema validation | Already used |
| None new | - | - |

---

## 4. Acceptance Criteria (BDD Scenarios)

### 4.1 Import Postman Collection

```gherkin
Scenario: Import valid Postman v2.1 collection
  Given a file "api.postman_collection.json" with valid v2.1 format
  And it contains 3 requests with headers and body
  When I run "import api.postman_collection.json"
  Then a new collection "api" is created in collections.yaml
  And all 3 requests are imported with correct method, path, headers, body
  And variable syntax "{{var}}" is converted to "${var}"

Scenario: Import Postman with nested folders
  Given a Postman collection with folders "Auth" and "Users"
  When I run "import nested.postman_collection.json"
  Then folder names become collection names
  And items within each folder become collection items

Scenario: Import Postman skips environments
  Given a Postman export with "environment" key
  When I run "import with-env.postman_collection.json"
  Then the collection is imported
  And a warning is shown: "Environments skipped (use unireq profiles)"

Scenario: Reject unsupported Postman version
  Given a Postman collection with schema version "v2.0.0"
  When I run "import old.postman_collection.json"
  Then import fails with "Unsupported Postman version: v2.0.0"
  And hint is shown: "Expected v2.1.0. Export from Postman using latest format."
```

### 4.2 Import Insomnia Workspace

```gherkin
Scenario: Import Insomnia v4 export
  Given an Insomnia export file with _type: "export"
  And it contains resources of type "request"
  When I run "import insomnia.json"
  Then requests are imported as collection items
  And "request_group" resources become collection separators

Scenario: Import Insomnia skips environments
  Given an Insomnia export with "environment" resources
  When I run "import insomnia.json"
  Then environment resources are skipped
  And a warning is shown

Scenario: Import Insomnia with folder structure
  Given an Insomnia export with nested request_groups
  When I run "import insomnia.json"
  Then folder hierarchy is flattened to collection names
  And parent path is prefixed: "Auth/Login" → collection "Auth-Login"
```

### 4.3 Import HAR Archive

```gherkin
Scenario: Import HAR 1.2 from browser
  Given a HAR file with 5 HTTP entries
  When I run "import capture.har"
  Then a collection "capture" is created
  And each entry becomes a collection item
  And request method, url, headers, postData are preserved

Scenario: Import HAR filters by domain
  Given a HAR file with requests to multiple domains
  When I run "import capture.har --filter-domain api.example.com"
  Then only requests to api.example.com are imported

Scenario: Import HAR extracts relative paths
  Given a HAR entry with absolute URL "https://api.example.com/users/123"
  When I run "import capture.har --base-url https://api.example.com"
  Then the item path is stored as "/users/123"
```

### 4.4 Merge Strategies

```gherkin
Scenario: Merge - add new items only
  Given collection "api" exists with items "login", "logout"
  And import file contains items "login", "users"
  When I run "import api.json --merge"
  Then "users" is added to collection
  And existing "login" is unchanged

Scenario: Replace - overwrite entire collection
  Given collection "api" exists with 5 items
  And import file contains 3 different items
  When I run "import api.json --replace"
  Then collection "api" has exactly 3 items
  And all original items are removed

Scenario: Rename - create new collection
  Given collection "api" exists
  And import file also names collection "api"
  When I run "import api.json --rename"
  Then new collection "api-imported" is created
  And original "api" is unchanged

Scenario: Interactive prompt on conflict
  Given collection "api" exists
  And import file contains collection "api"
  When I run "import api.json" without flags
  Then user is prompted: "Collection 'api' exists. [M]erge, [R]eplace, re[N]ame?"
```

### 4.5 Export Collections

```gherkin
Scenario: Export to Postman v2.1
  Given collection "api" with 3 items
  When I run "export api --format postman"
  Then file "api.postman_collection.json" is created
  And schema version is "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  And all items are properly formatted

Scenario: Export to HAR 1.2
  Given collection "api" with 3 items
  When I run "export api --format har"
  Then file "api.har" is created
  And version is "1.2"
  And each item becomes a HAR entry

Scenario: Export multiple collections
  Given collections "auth" and "users"
  When I run "export auth users --format postman"
  Then "auth.postman_collection.json" is created
  And "users.postman_collection.json" is created

Scenario: Export all collections
  Given workspace has 5 collections
  When I run "export --all --format postman"
  Then 5 Postman JSON files are created
```

### 4.6 Edge Cases

```gherkin
Scenario: Handle empty collection
  Given a Postman collection with no items
  When I run "import empty.json"
  Then collection is created with 0 items
  And warning is shown: "Imported collection 'empty' has no items"

Scenario: Handle malformed JSON
  Given a file that is not valid JSON
  When I run "import malformed.json"
  Then import fails with "Invalid JSON: Unexpected token at line 5"

Scenario: Handle binary body in HAR
  Given a HAR entry with binary postData (image upload)
  When I run "import upload.har"
  Then item is imported with body marked as "[binary data]"
  And warning is shown

Scenario: Handle URL-encoded form data
  Given a Postman request with x-www-form-urlencoded body
  When I run "import form.json"
  Then body is preserved as form parameters
  And Content-Type header is set correctly

Scenario: Normalize header case
  Given imported request with header "content-type"
  Then header is normalized to "Content-Type"
```

---

## 5. Implementation Plan

### Block 1: Import Types and Validation Schemas

**Packages:** `packages/cli`

**Changes:**
- **Types:** Add `PostmanCollection`, `InsomniaExport`, `HarLog` types
- **Schemas:** Valibot schemas for each format validation
- **Utilities:** Format detection (auto-detect from content)

**Complexity:** S
**Dependencies:** None

**Tests:**
- Schema validation tests
- Format detection tests

**Acceptance criteria covered:** INV-1, INV-2

---

### Block 2: Postman v2.1 Importer

**Packages:** `packages/cli`

**Changes:**
- **Importer:** `import/postman.ts` - parse and convert
- **Mapper:** `PostmanRequest` → `SavedRequest`
- **Variable converter:** `{{var}}` → `${var}`

**Complexity:** M
**Dependencies:** Block 1

**Tests:**
- Unit tests for mapping logic
- Integration tests with fixture files
- Edge case tests (nested folders, variables)

**Acceptance criteria covered:** US1, 4.1 scenarios

---

### Block 3: Insomnia v4 Importer

**Packages:** `packages/cli`

**Changes:**
- **Importer:** `import/insomnia.ts` - parse resources
- **Mapper:** `InsomniaRequest` → `SavedRequest`
- **Folder flattening:** request_group hierarchy → collection names

**Complexity:** M
**Dependencies:** Block 1

**Tests:**
- Unit tests for resource parsing
- Integration tests with fixture files
- Edge case tests (nested groups, environments)

**Acceptance criteria covered:** US2, 4.2 scenarios

---

### Block 4: HAR 1.2 Importer

**Packages:** `packages/cli`

**Changes:**
- **Importer:** `import/har.ts` - parse HAR log
- **Mapper:** `HarEntry` → `SavedRequest`
- **URL parser:** Extract relative path from absolute URL
- **Filter:** `--filter-domain`, `--base-url` options

**Complexity:** M
**Dependencies:** Block 1

**Tests:**
- Unit tests for entry parsing
- Integration tests with real HAR files
- Edge case tests (binary, form data)

**Acceptance criteria covered:** US3, 4.3 scenarios

---

### Block 5: Merge Strategy Engine

**Packages:** `packages/cli`

**Changes:**
- **Merger:** `merge.ts` - compare and merge collections
- **Strategies:** merge, replace, rename implementations
- **Interactive prompt:** REPL integration for conflict resolution

**Complexity:** S
**Dependencies:** None

**Tests:**
- Unit tests for each strategy
- Interactive mode tests

**Acceptance criteria covered:** 2.3, 4.4 scenarios

---

### Block 6: Postman v2.1 Exporter

**Packages:** `packages/cli`

**Changes:**
- **Exporter:** `export/postman.ts` - generate Postman JSON
- **Mapper:** `SavedRequest` → `PostmanRequest`
- **Variable converter:** `${var}` → `{{var}}`

**Complexity:** M
**Dependencies:** Block 1

**Tests:**
- Unit tests for mapping
- Round-trip tests (import → export → import)
- Validation against Postman schema

**Acceptance criteria covered:** US4, 4.5 scenarios

---

### Block 7: HAR 1.2 Exporter

**Packages:** `packages/cli`

**Changes:**
- **Exporter:** `export/har.ts` - generate HAR file
- **Mapper:** `SavedRequest` → `HarEntry`
- **Metadata:** Add creator, version info

**Complexity:** S
**Dependencies:** Block 1

**Tests:**
- Unit tests for mapping
- Validation against HAR 1.2 spec

**Acceptance criteria covered:** US4, 4.5 scenarios

---

### Block 8: REPL Commands Integration

**Packages:** `packages/cli`

**Changes:**
- **Commands:** `importHandler`, `exportHandler` in `commands.ts`
- **Arguments:** Format parsing, flag handling
- **Output:** Progress messages, warnings, success confirmation

**Complexity:** S
**Dependencies:** Blocks 2-7

**Tests:**
- E2E tests for full workflow
- Error handling tests

**Acceptance criteria covered:** All user stories

---

## 6. Test Strategy

### 6.1 Test Matrix

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Postman import valid | Yes | Yes | Yes |
| Postman nested folders | Yes | Yes | - |
| Postman skip environments | Yes | - | - |
| Postman version error | Yes | - | - |
| Insomnia import | Yes | Yes | Yes |
| Insomnia folder flatten | Yes | Yes | - |
| HAR import | Yes | Yes | Yes |
| HAR domain filter | Yes | Yes | - |
| Merge strategies | Yes | Yes | - |
| Interactive prompt | - | Yes | - |
| Export Postman | Yes | Yes | Yes |
| Export HAR | Yes | Yes | - |
| Round-trip | - | Yes | - |
| Error handling | Yes | - | - |

### 6.2 Test Fixtures

Create fixture files in `src/collections/import/__tests__/fixtures/`:

| Fixture | Purpose |
|---------|---------|
| `postman-v2.1-simple.json` | Basic Postman collection |
| `postman-v2.1-nested.json` | With folders |
| `postman-v2.1-variables.json` | With {{var}} syntax |
| `postman-v2.0-unsupported.json` | Version error case |
| `insomnia-v4-simple.json` | Basic Insomnia export |
| `insomnia-v4-nested.json` | With request_groups |
| `har-1.2-simple.har` | Basic HAR file |
| `har-1.2-multi-domain.har` | Multiple domains |
| `malformed.json` | Invalid JSON |

### 6.3 Test Structure (AAA Pattern)

```typescript
describe('PostmanImporter', () => {
  describe('parseCollection', () => {
    it('should convert Postman request to SavedRequest', () => {
      // Arrange
      const postmanRequest = { method: 'GET', url: '{{baseUrl}}/users' };

      // Act
      const result = convertRequest(postmanRequest);

      // Assert
      expect(result.method).toBe('GET');
      expect(result.path).toBe('${baseUrl}/users');
    });
  });
});
```

### 6.4 Coverage Requirements

| Area | Target |
|------|--------|
| Importers | 100% branch coverage |
| Exporters | 100% branch coverage |
| Merge logic | 100% branch coverage |
| Commands | 90% line coverage |

---

## Definition of Done

- [ ] Block 1: Import types and schemas
- [ ] Block 2: Postman importer with tests
- [ ] Block 3: Insomnia importer with tests
- [ ] Block 4: HAR importer with tests
- [ ] Block 5: Merge strategy engine with tests
- [ ] Block 6: Postman exporter with tests
- [ ] Block 7: HAR exporter with tests
- [ ] Block 8: REPL commands integration
- [ ] All BDD scenarios have passing tests
- [ ] All tests pass (`pnpm test`)
- [ ] Lint/typecheck pass (`pnpm biome check`, `pnpm type-check`)
- [ ] Documentation updated (COMMANDS.md, help text)
- [ ] TODO_COLLECTIONS.md updated with completion status
