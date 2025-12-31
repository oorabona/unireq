---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: OpenAPI Spec Loader (Task 3.1)

## 1. User Stories

### US-1: Load Local OpenAPI File

**AS A** developer with a local OpenAPI specification
**I WANT** to load the spec from a file path
**SO THAT** I can explore the API in unireq REPL

**ACCEPTANCE:** `loadSpec('./openapi.yaml')` returns parsed, dereferenced document

### US-2: Load Remote OpenAPI Spec

**AS A** developer working with a hosted API
**I WANT** to load the spec from a URL
**SO THAT** I can explore the API without downloading files

**ACCEPTANCE:** `loadSpec('https://api.example.com/openapi.json')` returns parsed document

### US-3: Handle Invalid Specs

**AS A** developer debugging spec issues
**I WANT** clear error messages when loading fails
**SO THAT** I can fix the spec quickly

**ACCEPTANCE:** Invalid specs throw typed errors with actionable messages

---

## 2. Business Rules

### Source Detection

| Input | Source Type | Action |
|-------|-------------|--------|
| Starts with `http://` or `https://` | URL | Fetch then parse |
| Starts with `./` or `/` or contains no `://` | File | Read then parse |

### Version Detection

| Field | Version | Notes |
|-------|---------|-------|
| `openapi: "3.1.x"` | OpenAPI 3.1 | JSON Schema compatible |
| `openapi: "3.0.x"` | OpenAPI 3.0 | Most common |
| `swagger: "2.0"` | Swagger 2.0 | Legacy, supported |

### Reference Resolution

1. All `$ref` pointers MUST be resolved (dereferenced)
2. Internal refs (`#/components/schemas/User`) → inline
3. External file refs (`./common.yaml#/User`) → load and inline
4. External URL refs → fetch and inline
5. Circular refs → handled by parser (stops recursion)

### Error Hierarchy

```
SpecError (base)
├── SpecNotFoundError    - File/URL not found
├── SpecLoadError        - Network/IO error
└── SpecParseError       - Invalid content
    ├── Invalid JSON/YAML syntax
    ├── Missing openapi/swagger field
    └── Schema validation failure
```

---

## 3. Technical Impact

### Files to Create

| File | Purpose |
|------|---------|
| `src/openapi/types.ts` | Type definitions |
| `src/openapi/errors.ts` | Custom error classes |
| `src/openapi/loader.ts` | Main loader logic |
| `src/openapi/index.ts` | Public exports |

### Types

```typescript
type SpecVersion = '2.0' | '3.0' | '3.1';

interface LoadedSpec {
  /** Detected spec version */
  version: SpecVersion;
  /** Full version string (e.g., "3.1.0") */
  versionFull: string;
  /** Source path or URL */
  source: string;
  /** Dereferenced OpenAPI document */
  document: OpenAPIDocument;
}

interface LoadOptions {
  /** Timeout for URL fetches (ms) */
  timeout?: number;
  /** Allow HTTP (not just HTTPS) for localhost */
  allowInsecureLocalhost?: boolean;
}
```

### Public API

```typescript
/**
 * Load and parse an OpenAPI specification
 * @param source - File path or URL
 * @param options - Load options
 * @returns Parsed and dereferenced spec
 * @throws SpecNotFoundError | SpecLoadError | SpecParseError
 */
async function loadSpec(source: string, options?: LoadOptions): Promise<LoadedSpec>;

/**
 * Check if a source looks like a URL
 */
function isUrl(source: string): boolean;

/**
 * Detect OpenAPI version from document
 */
function detectVersion(doc: unknown): SpecVersion;
```

### Dependencies

```json
{
  "@scalar/openapi-parser": "^1.x"
}
```

---

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Load local JSON file

```gherkin
Given a valid OpenAPI 3.0 JSON file at "./fixtures/petstore.json"
When loadSpec("./fixtures/petstore.json") is called
Then result.version equals "3.0"
And result.document.info.title equals "Petstore API"
And result.source equals "./fixtures/petstore.json"
```

### Scenario 2: Load local YAML file

```gherkin
Given a valid OpenAPI 3.1 YAML file at "./fixtures/users.yaml"
When loadSpec("./fixtures/users.yaml") is called
Then result.version equals "3.1"
And result.document contains resolved schemas
```

### Scenario 3: Load from HTTPS URL

```gherkin
Given a valid OpenAPI spec at "https://petstore3.swagger.io/api/v3/openapi.json"
When loadSpec("https://petstore3.swagger.io/api/v3/openapi.json") is called
Then result.version equals "3.0"
And result.document.paths contains "/pet"
```

### Scenario 4: Resolve internal $ref

```gherkin
Given a spec with "$ref": "#/components/schemas/Pet"
When loadSpec(path) is called
Then the $ref is replaced with the actual Pet schema inline
```

### Scenario 5: Resolve external file $ref

```gherkin
Given a spec with "$ref": "./schemas/common.yaml#/Error"
And "./schemas/common.yaml" exists with Error schema
When loadSpec(path) is called
Then the $ref is resolved and inlined
```

### Scenario 6: Detect Swagger 2.0

```gherkin
Given a spec with "swagger": "2.0"
When loadSpec(path) is called
Then result.version equals "2.0"
And result.versionFull equals "2.0"
```

### Scenario 7: Detect OpenAPI 3.0.x

```gherkin
Given a spec with "openapi": "3.0.3"
When loadSpec(path) is called
Then result.version equals "3.0"
And result.versionFull equals "3.0.3"
```

### Scenario 8: Detect OpenAPI 3.1.x

```gherkin
Given a spec with "openapi": "3.1.0"
When loadSpec(path) is called
Then result.version equals "3.1"
And result.versionFull equals "3.1.0"
```

### Scenario 9: File not found

```gherkin
Given no file at "./nonexistent.yaml"
When loadSpec("./nonexistent.yaml") is called
Then SpecNotFoundError is thrown
And error.message contains "nonexistent.yaml"
```

### Scenario 10: URL returns 404

```gherkin
Given a URL that returns HTTP 404
When loadSpec("https://example.com/missing.json") is called
Then SpecNotFoundError is thrown
And error.message contains "404"
```

### Scenario 11: Invalid JSON syntax

```gherkin
Given a file with invalid JSON: "{ invalid: }"
When loadSpec(path) is called
Then SpecParseError is thrown
And error.message contains "JSON" or "syntax"
```

### Scenario 12: Invalid YAML syntax

```gherkin
Given a file with invalid YAML (bad indentation)
When loadSpec(path) is called
Then SpecParseError is thrown
And error.message contains "YAML" or "syntax"
```

### Scenario 13: Missing openapi/swagger field

```gherkin
Given a valid YAML file but no "openapi" or "swagger" field
When loadSpec(path) is called
Then SpecParseError is thrown
And error.message contains "not a valid OpenAPI"
```

### Scenario 14: Empty file

```gherkin
Given an empty file
When loadSpec(path) is called
Then SpecParseError is thrown
And error.message contains "empty"
```

### Scenario 15: Network timeout

```gherkin
Given a URL that takes too long to respond
And options.timeout is 1000ms
When loadSpec(url, { timeout: 1000 }) is called
Then SpecLoadError is thrown
And error.message contains "timeout"
```

### Scenario 16: HTTP URL blocked (non-localhost)

```gherkin
Given a URL "http://api.example.com/spec.json" (not HTTPS)
When loadSpec(url) is called
Then SpecLoadError is thrown
And error.message contains "HTTPS required"
```

### Scenario 17: HTTP localhost allowed

```gherkin
Given a URL "http://localhost:3000/spec.json"
And options.allowInsecureLocalhost is true
When loadSpec(url, { allowInsecureLocalhost: true }) is called
Then the spec is loaded successfully
```

---

## 5. Implementation Plan

### Block 1: Types and Errors (Vertical Slice)

**Files:**
- `src/openapi/types.ts`
- `src/openapi/errors.ts`
- `src/openapi/__tests__/errors.test.ts`

**Tasks:**
- Define `LoadedSpec`, `LoadOptions`, `SpecVersion` types
- Create `SpecError`, `SpecNotFoundError`, `SpecLoadError`, `SpecParseError`
- Unit tests for error creation and messages

**Acceptance criteria covered:** #9, #10, #11, #13, #14

### Block 2: URL Detection and Version Detection (Vertical Slice)

**Files:**
- `src/openapi/utils.ts`
- `src/openapi/__tests__/utils.test.ts`

**Tasks:**
- Implement `isUrl(source)` function
- Implement `detectVersion(doc)` function
- Implement `isLocalhost(url)` for security check
- Unit tests for all utility functions

**Acceptance criteria covered:** #6, #7, #8

### Block 3: File Loader (Vertical Slice)

**Files:**
- `src/openapi/loader.ts` (partial)
- `src/openapi/__tests__/loader-file.test.ts`

**Tasks:**
- Implement file loading (read + detect format)
- Integrate with @scalar/openapi-parser for parsing
- Handle $ref resolution for files
- Tests with fixtures (JSON + YAML)

**Acceptance criteria covered:** #1, #2, #4, #5, #9, #11, #12, #13, #14

### Block 4: URL Loader (Vertical Slice)

**Files:**
- `src/openapi/loader.ts` (complete)
- `src/openapi/__tests__/loader-url.test.ts`

**Tasks:**
- Implement URL fetching with timeout
- HTTPS enforcement (except localhost)
- Handle network errors
- Tests with msw mock server

**Acceptance criteria covered:** #3, #10, #15, #16, #17

### Block 5: Integration and Exports (Vertical Slice)

**Files:**
- `src/openapi/index.ts`
- `src/openapi/__tests__/integration.test.ts`

**Tasks:**
- Export public API
- Integration tests with real Petstore spec
- Update TODO_OPENAPI.md

**Acceptance criteria covered:** All (integration verification)

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| #1 JSON file | Yes | Yes |
| #2 YAML file | Yes | Yes |
| #3 HTTPS URL | - | Yes (msw) |
| #4 Internal $ref | Yes | Yes |
| #5 External $ref | Yes | Yes |
| #6 Swagger 2.0 | Yes | - |
| #7 OpenAPI 3.0 | Yes | - |
| #8 OpenAPI 3.1 | Yes | - |
| #9 File not found | Yes | - |
| #10 URL 404 | Yes (msw) | - |
| #11 Invalid JSON | Yes | - |
| #12 Invalid YAML | Yes | - |
| #13 Missing version | Yes | - |
| #14 Empty file | Yes | - |
| #15 Timeout | Yes (msw) | - |
| #16 HTTP blocked | Yes | - |
| #17 HTTP localhost | Yes | - |

### Test Fixtures

```
src/openapi/__tests__/fixtures/
├── petstore-3.0.json      # Valid OpenAPI 3.0
├── petstore-3.1.yaml      # Valid OpenAPI 3.1
├── swagger-2.0.json       # Valid Swagger 2.0
├── with-refs.yaml         # Has $ref pointers
├── schemas/
│   └── common.yaml        # External ref target
├── invalid-json.json      # Syntax error
├── invalid-yaml.yaml      # Syntax error
├── not-openapi.yaml       # Missing openapi field
└── empty.yaml             # Empty file
```

---

## Definition of Done

- [ ] All 5 blocks implemented
- [ ] All 17 BDD scenarios have passing tests
- [ ] All tests pass (unit + integration)
- [ ] Lint/typecheck pass
- [ ] Documentation updated
- [ ] TODO_OPENAPI.md updated
