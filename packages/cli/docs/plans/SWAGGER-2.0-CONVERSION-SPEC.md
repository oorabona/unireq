---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Swagger 2.0 Conversion (Task 3.7)

## 1. User Stories

### US-1: Automatic Swagger 2.0 Conversion
**AS A** CLI user loading legacy API specifications
**I WANT** Swagger 2.0 specs to be automatically converted to OpenAPI 3.1
**SO THAT** I can use all CLI features (navigation, describe, validation) with older API docs

**ACCEPTANCE:** Swagger 2.0 specs load seamlessly, all features work as expected

## 2. Business Rules

### BR-1: Automatic Conversion on Load
- Conversion happens transparently during `loadSpec()`
- User does not need to run a separate command
- Original version preserved in `LoadedSpec.version` for display
- Converted document uses OpenAPI 3.1.0 structure

### BR-2: Structural Conversions

| Swagger 2.0 | OpenAPI 3.1 |
|-------------|-------------|
| `swagger: "2.0"` | `openapi: "3.1.0"` |
| `host`, `basePath`, `schemes` | `servers: [{ url: "..." }]` |
| `definitions` | `components.schemas` |
| `parameters` (global) | `components.parameters` |
| `responses` (global) | `components.responses` |
| `consumes`, `produces` | Operation-level content types |
| `$ref: "#/definitions/X"` | `$ref: "#/components/schemas/X"` |

### BR-3: Server URL Construction

Given Swagger 2.0 fields:
- `host`: "api.example.com"
- `basePath`: "/v1"
- `schemes`: ["https", "http"]

Result:
```yaml
servers:
  - url: https://api.example.com/v1
  - url: http://api.example.com/v1
```

**Edge cases:**
- No `schemes` → default to `["https"]`
- No `host` → relative URL from `basePath` only
- No `basePath` → use `/`

### BR-4: Graceful Degradation
- Unsupported Swagger 2.0 features log a warning
- Security schemes: Log warning, omit from converted spec
- x-* extensions: Preserve as-is
- Invalid Swagger 2.0: SpecParseError with descriptive message

### BR-5: Caching Behavior
- Cached spec contains the converted OpenAPI 3.1 document
- Cache key based on original source (file path or URL)
- Cache invalidation same as existing logic (mtime/ETag)

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| openapi/converter.ts | NEW: Conversion module using @scalar/openapi-parser upgrade | Unit tests |
| openapi/loader.ts | Integrate conversion after parsing, before caching | Integration tests |
| openapi/types.ts | Add `originalVersion` field to LoadedSpec (optional) | TypeScript |

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Basic Swagger 2.0 Conversion
```gherkin
Given a Swagger 2.0 spec file with version "swagger": "2.0"
When loaded with loadSpec()
Then the returned document has "openapi": "3.1.0"
And LoadedSpec.version is "2.0" (original)
And LoadedSpec.document.openapi is "3.1.0"
```

### Scenario 2: Server URL from Host/BasePath/Schemes
```gherkin
Given a Swagger 2.0 spec with:
  | host     | api.example.com |
  | basePath | /v1             |
  | schemes  | ["https"]       |
When converted
Then document.servers[0].url is "https://api.example.com/v1"
```

### Scenario 3: Multiple Schemes
```gherkin
Given a Swagger 2.0 spec with schemes ["https", "http"]
When converted
Then document.servers has 2 entries
And servers[0].url starts with "https://"
And servers[1].url starts with "http://"
```

### Scenario 4: No Schemes (Default HTTPS)
```gherkin
Given a Swagger 2.0 spec without schemes field
When converted
Then document.servers[0].url starts with "https://"
```

### Scenario 5: No Host (Relative URL)
```gherkin
Given a Swagger 2.0 spec without host but with basePath "/api"
When converted
Then document.servers[0].url is "/api"
```

### Scenario 6: Definitions to Components.Schemas
```gherkin
Given a Swagger 2.0 spec with definitions.User schema
When converted
Then document.components.schemas.User exists
And has the same properties as original definition
```

### Scenario 7: $ref Path Updates
```gherkin
Given a Swagger 2.0 spec with "$ref": "#/definitions/User"
When converted
Then the ref is updated to "$ref": "#/components/schemas/User"
```

### Scenario 8: Navigation Tree Works After Conversion
```gherkin
Given a converted Swagger 2.0 spec loaded
When building navigation tree
Then all paths are indexed correctly
And ls command lists operations
```

### Scenario 9: Describe Command Works After Conversion
```gherkin
Given a converted Swagger 2.0 spec loaded
When running describe on an operation
Then operation details are displayed correctly
```

### Scenario 10: Input Validation Works After Conversion
```gherkin
Given a converted Swagger 2.0 spec with required path parameter
When validating a request missing that parameter
Then validation warning is displayed
```

### Scenario 11: Cache Stores Converted Spec
```gherkin
Given a Swagger 2.0 spec loaded for the first time
When the spec is cached
And loaded again from cache
Then the cached version is already converted to OpenAPI 3.1
```

### Scenario 12: OpenAPI 3.x Specs Pass Through
```gherkin
Given an OpenAPI 3.0 or 3.1 spec
When loaded with loadSpec()
Then the spec is returned as-is without modification
```

## 5. Implementation Plan

### Block 1: Converter Module
**Packages:** cli

- **Module:** Create `openapi/converter.ts`:
  - `convertSwagger2ToOpenAPI3(spec: unknown): OpenAPIDocument`
  - Use @scalar/openapi-parser `upgrade` function
  - Handle edge cases (no host, no schemes)
  - Log warnings for unsupported features
- **Types:** No changes needed (upgrade returns valid OpenAPIDocument)
- **Tests:** Unit tests for converter function

**Complexity:** S
**Acceptance criteria covered:** #1, #2, #3, #4, #5, #6, #7

### Block 2: Loader Integration
**Packages:** cli

- **Integration:** Modify `loader.ts`:
  - After parsing, check if Swagger 2.0
  - If yes, call converter before dereferencing
  - Store original version in LoadedSpec
- **Cache:** Converted spec is cached (not original)
- **Tests:** Integration tests for full load flow

**Complexity:** S
**Acceptance criteria covered:** #11, #12

### Block 3: Feature Verification
**Packages:** cli

- **Verification:** Ensure existing features work:
  - Navigation tree builds correctly
  - Describe command works
  - Input validation works
- **Tests:** Integration tests with converted spec

**Complexity:** S
**Acceptance criteria covered:** #8, #9, #10

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Basic conversion | Yes | Yes |
| Server URL construction | Yes | - |
| Multiple schemes | Yes | - |
| No schemes default | Yes | - |
| No host relative URL | Yes | - |
| Definitions to schemas | Yes | - |
| $ref updates | Yes | - |
| Navigation after convert | - | Yes |
| Describe after convert | - | Yes |
| Validation after convert | - | Yes |
| Cache stores converted | - | Yes |
| OpenAPI 3.x passthrough | - | Yes |

### Test Data Strategy
- Extend existing `fixtures/swagger-2.0.json` with more edge cases
- Create `fixtures/swagger-2.0-minimal.json` (minimal valid Swagger)
- Use existing OpenAPI 3.x fixtures for passthrough tests

---

## Definition of Done

- [x] All blocks implemented ✅ 2026-01-01
- [x] All BDD scenarios have passing tests (27 tests) ✅ 2026-01-01
- [x] All tests pass (265 OpenAPI tests) ✅ 2026-01-01
- [x] Lint/typecheck pass ✅ 2026-01-01
- [x] Documentation updated (TODO_OPENAPI.md) ✅ 2026-01-01
