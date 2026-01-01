---
doc-meta:
  status: draft
  scope: output
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Syntax Highlighting (Task 7.3)

## 1. User Stories

### US-1: JSON Syntax Highlighting

**AS A** developer reading API responses
**I WANT** JSON response bodies to be syntax-highlighted
**SO THAT** I can quickly scan and identify keys, values, and data types

**ACCEPTANCE:** JSON keys, strings, numbers, booleans, and null are distinctly colored

### US-2: XML Syntax Highlighting

**AS A** developer working with XML APIs (SOAP, RSS, Atom)
**I WANT** XML response bodies to be syntax-highlighted
**SO THAT** I can distinguish tags, attributes, and text content

**ACCEPTANCE:** XML tags, attributes, and values are distinctly colored

### US-3: Color Control

**AS A** user with color preferences or piping output
**I WANT** syntax highlighting to respect NO_COLOR and color settings
**SO THAT** I have consistent control over terminal colors

**ACCEPTANCE:** Highlighting disabled when colors are disabled

---

## 2. Business Rules

### Content-Type Detection

| Content-Type | Highlighting Applied |
|--------------|---------------------|
| `application/json` | JSON highlighting |
| `application/xml` | XML highlighting |
| `text/xml` | XML highlighting |
| `*+json` (suffix) | JSON highlighting |
| `*+xml` (suffix) | XML highlighting |
| Other/Unknown | No highlighting (plain text) |

### JSON Color Scheme

| Token Type | Color | picocolors Function |
|------------|-------|---------------------|
| Key (property name) | Cyan | `pc.cyan` |
| String value | Green | `pc.green` |
| Number | Yellow | `pc.yellow` |
| Boolean (true/false) | Magenta | `pc.magenta` |
| Null | Dim | `pc.dim` |
| Brackets/Braces | Default | none |
| Colon/Comma | Default | none |

### XML Color Scheme

| Token Type | Color | picocolors Function |
|------------|-------|---------------------|
| Tag name (<tag>) | Cyan | `pc.cyan` |
| Attribute name | Yellow | `pc.yellow` |
| Attribute value | Green | `pc.green` |
| Text content | Default | none |
| Comment (<!-- -->) | Dim | `pc.dim` |
| CDATA | Default | none |
| Declaration (<?xml) | Dim | `pc.dim` |

### Invariants

1. Highlighting MUST NOT alter the semantic content of the body
2. Highlighting MUST be applied only in pretty mode with colors enabled
3. Malformed content MUST be displayed as-is without crashing
4. Empty body MUST return empty string

### Preconditions

- `formatBody()` receives content and content-type
- `useColors` flag determines if highlighting is applied

### Effects

- Body content is returned with ANSI color codes embedded
- Content remains valid (colors are wrapping, not replacing)

### Errors

| Error Case | Behavior |
|------------|----------|
| Invalid JSON syntax | Display raw content, no crash |
| Invalid XML syntax | Display raw content, no crash |
| null/undefined body | Return empty string |
| Binary content | Pass through unchanged |

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| New Module | `src/output/highlighter.ts` | Unit tests for each token type |
| Formatter | Modify `formatBody()` to call highlighter | Integration tests |
| Types | Add highlight-related types | Type-check |
| Dependencies | None (use existing picocolors) | - |

### File Structure

```
src/output/
├── highlighter.ts    (NEW)
├── formatter.ts      (MODIFY)
├── colors.ts         (existing)
├── types.ts          (MODIFY - add types)
└── index.ts          (MODIFY - export)
```

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: JSON Key Highlighting

```gherkin
Scenario: Highlight JSON object keys
  Given pretty mode is active with colors enabled
  And response content-type is "application/json"
  When body contains {"name": "Alice", "age": 30}
  Then "name" and "age" are displayed in cyan
```

### S-2: JSON Value Type Highlighting

```gherkin
Scenario: Highlight JSON values by type
  Given pretty mode is active with colors enabled
  And response content-type is "application/json"
  When body contains {"str": "text", "num": 42, "bool": true, "nil": null}
  Then "text" is displayed in green
  And 42 is displayed in yellow
  And true is displayed in magenta
  And null is displayed dim
```

### S-3: Nested JSON Highlighting

```gherkin
Scenario: Highlight nested JSON structures
  Given pretty mode is active with colors enabled
  When body contains {"user": {"id": 1, "roles": ["admin", "user"]}}
  Then all keys at all nesting levels are highlighted
  And all values are highlighted according to their type
```

### S-4: XML Tag Highlighting

```gherkin
Scenario: Highlight XML tags
  Given pretty mode is active with colors enabled
  And response content-type is "application/xml"
  When body contains <user><name>Alice</name></user>
  Then "user" and "name" tag names are displayed in cyan
```

### S-5: XML Attribute Highlighting

```gherkin
Scenario: Highlight XML attributes
  Given pretty mode is active with colors enabled
  And response content-type is "text/xml"
  When body contains <user id="42" active="true">
  Then "id" and "active" attribute names are displayed in yellow
  And "42" and "true" attribute values are displayed in green
```

### S-6: XML Comment Highlighting

```gherkin
Scenario: Highlight XML comments
  Given pretty mode is active with colors enabled
  When body contains <!-- This is a comment -->
  Then comment content is displayed dim
```

### S-7: Colors Disabled

```gherkin
Scenario: No highlighting when colors disabled
  Given NO_COLOR environment variable is set
  When JSON response is displayed
  Then no ANSI escape codes are present
  And content is displayed as plain text
```

### S-8: Invalid JSON Graceful Handling

```gherkin
Scenario: Handle malformed JSON gracefully
  Given pretty mode is active with colors enabled
  And response content-type is "application/json"
  When body contains "{invalid json"
  Then content is displayed as-is
  And no error is thrown
```

### S-9: Invalid XML Graceful Handling

```gherkin
Scenario: Handle malformed XML gracefully
  Given pretty mode is active with colors enabled
  And response content-type is "application/xml"
  When body contains "<unclosed>tag"
  Then content is displayed as-is
  And no error is thrown
```

### S-10: Content-Type Detection with Suffix

```gherkin
Scenario: Detect JSON from content-type suffix
  Given response content-type is "application/vnd.api+json"
  When body is displayed
  Then JSON highlighting is applied
```

### S-11: Unknown Content-Type

```gherkin
Scenario: No highlighting for unknown content type
  Given response content-type is "text/plain"
  When body contains {"looks": "like json"}
  Then no syntax highlighting is applied
  And content is displayed as plain text
```

### S-12: Empty Body

```gherkin
Scenario: Handle empty body
  Given pretty mode is active with colors enabled
  When body is empty or null
  Then empty string is returned
  And no error is thrown
```

---

## 5. Implementation Plan

### Block 1: Highlighter Module + JSON Highlighting

**Package:** cli

**Files:**
- `src/output/highlighter.ts` (NEW)
- `src/output/types.ts` (MODIFY - add types)
- `src/output/index.ts` (MODIFY - export)
- `src/__tests__/output-highlighter.test.ts` (NEW)

**Deliverables:**
- `highlightJson(text: string, useColors: boolean): string`
- `detectContentType(contentType: string): 'json' | 'xml' | 'unknown'`
- JSON token colorization (keys, strings, numbers, booleans, null)
- Unit tests for JSON highlighting

**Acceptance criteria covered:** S-1, S-2, S-3, S-7, S-8, S-10, S-11, S-12

**Complexity:** M
**Dependencies:** None

### Block 2: XML Highlighting

**Package:** cli

**Files:**
- `src/output/highlighter.ts` (MODIFY)
- `src/__tests__/output-highlighter.test.ts` (MODIFY)

**Deliverables:**
- `highlightXml(text: string, useColors: boolean): string`
- XML token colorization (tags, attributes, comments, declarations)
- Unit tests for XML highlighting

**Acceptance criteria covered:** S-4, S-5, S-6, S-9

**Complexity:** M
**Dependencies:** Block 1

### Block 3: Formatter Integration

**Package:** cli

**Files:**
- `src/output/formatter.ts` (MODIFY)
- `src/__tests__/output-formatter.test.ts` (MODIFY)

**Deliverables:**
- Update `formatBody()` to apply highlighting based on content-type
- Integration tests for end-to-end formatting with highlighting

**Acceptance criteria covered:** All scenarios integrated

**Complexity:** S
**Dependencies:** Block 1, Block 2

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: JSON keys | Yes | Yes |
| S-2: JSON value types | Yes | Yes |
| S-3: Nested JSON | Yes | Yes |
| S-4: XML tags | Yes | Yes |
| S-5: XML attributes | Yes | Yes |
| S-6: XML comments | Yes | - |
| S-7: Colors disabled | Yes | Yes |
| S-8: Invalid JSON | Yes | Yes |
| S-9: Invalid XML | Yes | Yes |
| S-10: Content-type suffix | Yes | - |
| S-11: Unknown content-type | Yes | Yes |
| S-12: Empty body | Yes | - |

### Test Files

- `src/__tests__/output-highlighter.test.ts` (NEW) - Highlighter unit tests
- `src/__tests__/output-formatter.test.ts` (MODIFY) - Add integration tests

### Test Data Strategy

**JSON Fixtures:**
```typescript
const simpleJson = '{"key": "value"}';
const typedJson = '{"str": "text", "num": 42, "bool": true, "nil": null}';
const nestedJson = '{"user": {"id": 1, "roles": ["admin"]}}';
const invalidJson = '{broken';
```

**XML Fixtures:**
```typescript
const simpleXml = '<root><child>text</child></root>';
const attrXml = '<user id="42" active="true"/>';
const commentXml = '<!-- comment --><data/>';
const invalidXml = '<unclosed>';
```

---

## Definition of Done

- [ ] `highlighter.ts` module created with JSON + XML functions
- [ ] Content-type detection implemented
- [ ] `formatBody()` updated to use highlighter
- [ ] All 12 BDD scenarios have passing tests
- [ ] Tests follow AAA pattern
- [ ] All tests pass (existing + new)
- [ ] Lint/typecheck pass
- [ ] TODO_OUTPUT.md updated
- [ ] DOCUMENTATION_INDEX.md updated with this spec
