---
doc-meta:
  status: canonical
  scope: output
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Output Mode Selection + Pretty Formatting (Tasks 7.1+7.2)

## 1. User Stories

### US-1: Readable Response Display

**AS A** developer debugging API calls
**I WANT** color-coded, formatted HTTP responses
**SO THAT** I can quickly understand response status and content

**ACCEPTANCE:** Pretty mode as default with status coloring

### US-2: Machine-Readable Output

**AS A** DevOps engineer scripting with CLI
**I WANT** structured JSON output option
**SO THAT** I can pipe responses to jq or other tools

**ACCEPTANCE:** `--output json` produces valid JSON

### US-3: Raw Output for Piping

**AS A** user redirecting output to files
**I WANT** raw body-only output
**SO THAT** I can save response bodies without formatting

**ACCEPTANCE:** `--output raw` outputs only body content

---

## 2. Business Rules

### Output Modes

| Mode | Description | Default |
|------|-------------|---------|
| `pretty` | Colored, formatted output | YES |
| `json` | Full response as JSON object | NO |
| `raw` | Body only, no formatting | NO |

### Status Coloring (Pretty Mode)

| Status Range | Color | Example |
|--------------|-------|---------|
| 2xx | Green | 200 OK |
| 3xx | Yellow | 301 Moved |
| 4xx | Red | 404 Not Found |
| 5xx | Red | 500 Internal Server Error |

### Color Disable Rules

Colors disabled when:
- `NO_COLOR` environment variable is set (any value)
- Output is not a TTY (piped or redirected)
- `--output raw` or `--output json` mode

### Pretty Mode Format

```
HTTP/1.1 <status> <statusText>   ← colored by status
  <header-key>: <header-value>
  ...

<body>                           ← pretty-printed if JSON

── <status> <statusText> · <size> ──
```

### JSON Mode Format

```json
{
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json"
  },
  "body": { ... }
}
```

### Raw Mode Format

```
<body only, no headers, no status, no formatting>
```

---

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| Dependencies | Add picocolors to CLI package |
| Types | Add OutputMode type, OutputOptions interface |
| Executor | Refactor displayResponse to use formatter |
| New Module | src/output/formatter.ts |
| New Module | src/output/colors.ts |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Default Pretty Mode

```gherkin
Scenario: Display response in pretty mode by default
  Given no output flag is specified
  When a 200 OK response with JSON body is received
  Then status line "HTTP/1.1 200 OK" is displayed in green
  And headers are displayed with 2-space indent
  And body is pretty-printed with 2-space indent
  And summary line shows status and size
```

### S-2: JSON Output Mode

```gherkin
Scenario: Display response as JSON object
  Given --output json flag is specified
  When a response is received
  Then output is valid JSON object
  And contains status, statusText, headers, body keys
  And no ANSI color codes are present
```

### S-3: Raw Output Mode

```gherkin
Scenario: Display raw body only
  Given --output raw flag is specified
  When a response with body is received
  Then only body content is output
  And no status line is displayed
  And no headers are displayed
  And no ANSI color codes are present
```

### S-4: Status Color - Success (2xx)

```gherkin
Scenario: Green color for 2xx status
  Given pretty mode is active
  When a 200 OK response is received
  Then status line contains green ANSI codes
```

### S-5: Status Color - Redirect (3xx)

```gherkin
Scenario: Yellow color for 3xx status
  Given pretty mode is active
  When a 301 Moved Permanently response is received
  Then status line contains yellow ANSI codes
```

### S-6: Status Color - Error (4xx/5xx)

```gherkin
Scenario: Red color for error status
  Given pretty mode is active
  When a 404 Not Found response is received
  Then status line contains red ANSI codes
```

### S-7: NO_COLOR Environment Variable

```gherkin
Scenario: Disable colors via NO_COLOR env
  Given NO_COLOR environment variable is set
  And pretty mode is active
  When a response is received
  Then no ANSI color codes are present in output
```

### S-8: Empty Body Handling

```gherkin
Scenario: Handle empty response body
  Given pretty mode is active
  When a 204 No Content response is received
  Then status line and headers are displayed
  And no body section is displayed
  And summary line shows "0 bytes"
```

---

## 5. Implementation Plan

### Block 1: Color Utilities + Types

**Files:**
- `src/output/colors.ts` (NEW)
- `src/output/types.ts` (NEW)
- `package.json` (MODIFY - add picocolors)

**Deliverables:**
- OutputMode type: 'pretty' | 'json' | 'raw'
- OutputOptions interface
- shouldUseColors() - checks TTY, NO_COLOR env
- getStatusColor() - returns color function by status code
- Color wrapper functions using picocolors

**Tests:** Unit tests for color selection logic

**Acceptance criteria covered:** S-4, S-5, S-6, S-7 (partial)

### Block 2: Formatter Module

**Files:**
- `src/output/formatter.ts` (NEW)
- `src/output/index.ts` (NEW)

**Deliverables:**
- formatPretty() - colored, formatted output
- formatJson() - JSON object output
- formatRaw() - body-only output
- formatResponse() - dispatcher by mode

**Tests:** Unit tests for each format function

**Acceptance criteria covered:** S-1, S-2, S-3

### Block 3: Executor Integration

**Files:**
- `src/executor.ts` (MODIFY)
- `src/types.ts` (MODIFY - add outputMode to ParsedRequest)

**Deliverables:**
- Replace displayResponse() with formatResponse()
- Add outputMode to ParsedRequest
- Update executeRequest() to use formatter

**Tests:** Update executor tests, add integration tests

**Acceptance criteria covered:** S-1, S-7, S-8

### Block 4: CLI Flag Integration

**Files:**
- `src/cli.ts` (MODIFY - add --output flag)
- `src/repl/http-commands.ts` (MODIFY - pass outputMode)

**Deliverables:**
- Add --output flag to citty command
- Pass outputMode through to executor
- Default to 'pretty'

**Tests:** CLI flag parsing tests

**Acceptance criteria covered:** S-2, S-3 (complete)

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Pretty mode | Yes | Yes |
| S-2: JSON mode | Yes | Yes |
| S-3: Raw mode | Yes | Yes |
| S-4: 2xx green | Yes | - |
| S-5: 3xx yellow | Yes | - |
| S-6: 4xx/5xx red | Yes | - |
| S-7: NO_COLOR | Yes | Yes |
| S-8: Empty body | Yes | Yes |

### Test Files

- `src/__tests__/output-colors.test.ts` - Color utility tests
- `src/__tests__/output-formatter.test.ts` - Formatter tests
- `src/__tests__/executor.integration.test.ts` - Update with output modes

---

## Definition of Done

- [x] picocolors added to dependencies ✅
- [x] OutputMode type and options defined ✅
- [x] Color utilities implemented with tests (31 tests) ✅
- [x] Formatter module with 3 modes (30 tests) ✅
- [x] Executor updated to use formatter ✅
- [x] CLI --output flag added ✅
- [x] All 8 BDD scenarios have passing tests ✅
- [x] Lint/typecheck pass ✅
- [x] TODO updated ✅

**Completed:** 2025-12-31
