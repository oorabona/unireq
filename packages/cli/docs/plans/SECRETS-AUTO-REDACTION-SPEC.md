---
doc-meta:
  status: canonical
  scope: secrets
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Auto-redaction in Output (Task 6.7)

## 1. User Stories

### US1: Secure Terminal Output
**AS A** developer using unireq CLI
**I WANT** sensitive headers automatically redacted in output
**SO THAT** I don't accidentally expose credentials when sharing terminal sessions

**ACCEPTANCE:** Authorization, API key, and cookie headers show `[REDACTED]` by default

### US2: Debug with Full Values
**AS A** developer debugging authentication issues
**I WANT** to optionally reveal full header values
**SO THAT** I can troubleshoot without editing config

**ACCEPTANCE:** `--show-secrets` flag reveals all header values

### US3: Custom Redaction Patterns
**AS A** team with custom authentication headers
**I WANT** to configure additional redaction patterns
**SO THAT** our proprietary auth headers are also protected

**ACCEPTANCE:** Patterns in `workspace.yaml` are applied to output

## 2. Business Rules

### Default Sensitive Headers (always redacted)
| Header Pattern | Match Type | Example |
|----------------|------------|---------|
| `authorization` | Exact (case-insensitive) | `Authorization: Bearer xyz` |
| `x-api-key` | Exact (case-insensitive) | `X-API-Key: secret123` |
| `api-key` | Exact (case-insensitive) | `API-Key: abc` |
| `x-auth-token` | Exact (case-insensitive) | `X-Auth-Token: token` |
| `proxy-authorization` | Exact (case-insensitive) | `Proxy-Authorization: Basic xyz` |
| `cookie` | Exact (case-insensitive) | `Cookie: session=abc` |
| `set-cookie` | Exact (case-insensitive) | `Set-Cookie: session=abc` |

### Redaction Format
- Prefix preservation: `Authorization: Bearer [REDACTED]`
- For values without prefix: `X-API-Key: [REDACTED]`
- For cookies: `Cookie: [REDACTED]` (value only, not name)

### Configuration Structure
```yaml
# workspace.yaml
output:
  redaction:
    # Additional patterns (glob-style)
    patterns:
      - x-custom-auth
      - x-tenant-*
    # Show secrets by default (dangerous, use with caution)
    showSecrets: false
```

### Precedence
1. CLI flag `--show-secrets` overrides everything
2. Workspace `output.redaction.showSecrets` overrides default
3. Default: redact all sensitive headers

## 3. Technical Impact

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/output/redactor.ts` | **NEW** - Redaction logic module |
| `src/output/types.ts` | Add `RedactionOptions` interface |
| `src/output/formatter.ts` | Integrate redaction before display |
| `src/output/index.ts` | Export new functions |
| `src/workspace/config/types.ts` | Add `OutputConfig` type |
| `src/workspace/config/schema.ts` | Add output schema validation |

### Dependencies
- None (pure TypeScript, no external libs)

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Default Authorization Redaction
```gherkin
Given a response with header "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
When formatted in pretty mode
Then the header displays "Authorization: Bearer [REDACTED]"
```

### Scenario 2: API Key Redaction
```gherkin
Given a response with header "X-API-Key: sk-123456789"
When formatted in pretty mode
Then the header displays "X-API-Key: [REDACTED]"
```

### Scenario 3: Cookie Redaction
```gherkin
Given a response with header "Set-Cookie: session=abc123; Path=/; HttpOnly"
When formatted in pretty mode
Then the header displays "Set-Cookie: [REDACTED]"
```

### Scenario 4: Case Insensitive Matching
```gherkin
Given a response with header "authorization: basic dXNlcjpwYXNz"
When formatted in pretty mode
Then the header displays "authorization: Basic [REDACTED]"
```

### Scenario 5: Show Secrets Flag
```gherkin
Given a response with header "Authorization: Bearer secret123"
And the --show-secrets flag is enabled
When formatted in pretty mode
Then the header displays "Authorization: Bearer secret123"
```

### Scenario 6: Custom Patterns from Config
```gherkin
Given workspace config with pattern "x-custom-auth"
And a response with header "X-Custom-Auth: mytoken"
When formatted in pretty mode
Then the header displays "X-Custom-Auth: [REDACTED]"
```

### Scenario 7: Non-Sensitive Headers Unchanged
```gherkin
Given a response with header "Content-Type: application/json"
When formatted in pretty mode
Then the header displays "Content-Type: application/json"
```

### Scenario 8: Multiple Sensitive Headers
```gherkin
Given a response with headers:
  | Authorization | Bearer token123 |
  | X-API-Key | key456 |
  | Content-Type | application/json |
When formatted in pretty mode
Then headers display:
  | Authorization | Bearer [REDACTED] |
  | X-API-Key | [REDACTED] |
  | Content-Type | application/json |
```

### Scenario 9: Empty Authorization Value
```gherkin
Given a response with header "Authorization: "
When formatted in pretty mode
Then the header displays "Authorization: [REDACTED]"
```

### Scenario 10: Raw Mode No Redaction
```gherkin
Given a response with header "Authorization: Bearer secret"
When formatted in raw mode
Then the body is output as-is (headers not shown in raw mode)
```

### Scenario 11: JSON Mode Redaction
```gherkin
Given a response with header "Authorization: Bearer secret"
When formatted in json mode
Then the JSON output shows "Authorization": "Bearer [REDACTED]"
```

### Scenario 12: Wildcard Pattern Matching
```gherkin
Given workspace config with pattern "x-tenant-*"
And a response with header "X-Tenant-Secret: abc123"
When formatted in pretty mode
Then the header displays "X-Tenant-Secret: [REDACTED]"
```

## 5. Implementation Plan

### Block 1: Redactor Module + Default Patterns
**Packages:** cli (output)

- **Types:** `RedactionOptions`, `RedactionConfig` in `types.ts`
- **Module:** `redactor.ts` with:
  - `DEFAULT_SENSITIVE_HEADERS` constant
  - `redactHeaders(headers, options)` function
  - `shouldRedact(headerName, patterns)` helper
  - Prefix preservation logic
- **Tests:** Unit tests for all 12 scenarios
- **Acceptance criteria covered:** #1, #2, #3, #4, #7, #8, #9

**Complexity:** M
**Dependencies:** None

### Block 2: Formatter Integration + Flag Support
**Packages:** cli (output)

- **Types:** Add `showSecrets` to `OutputOptions`
- **Formatter:** Integrate `redactHeaders` in `formatPretty` and `formatJson`
- **Raw mode:** Confirm no change needed (body only)
- **Tests:** Integration tests for formatter with redaction

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Workspace Config Schema
**Packages:** cli (workspace/config)

- **Types:** Add `OutputConfig` with `redaction` property
- **Schema:** Valibot schema for output config
- **Loader:** Wire output config to REPL state
- **Tests:** Schema validation tests

**Complexity:** S
**Dependencies:** Block 1

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| Default Authorization Redaction | Yes | Yes |
| API Key Redaction | Yes | Yes |
| Cookie Redaction | Yes | Yes |
| Case Insensitive | Yes | - |
| Show Secrets Flag | Yes | Yes |
| Custom Patterns | Yes | Yes |
| Non-Sensitive Unchanged | Yes | - |
| Multiple Headers | Yes | - |
| Empty Value | Yes | - |
| Raw Mode | - | Yes |
| JSON Mode | Yes | Yes |
| Wildcard Patterns | Yes | - |

### Test Files
- `src/output/__tests__/redactor.test.ts` - Unit tests (~25 tests)
- `src/__tests__/output-redaction.integration.test.ts` - Integration tests (~10 tests)

---

## Definition of Done

- [ ] All blocks implemented
- [ ] All 12 BDD scenarios have passing tests
- [ ] All tests pass (unit + integration)
- [ ] Lint/typecheck pass
- [ ] Documentation updated (TODO_SECRETS.md)
