---
doc-meta:
  status: canonical
  scope: workspace
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Variable Interpolation (Task 2.4)

## 1. User Stories

### US-1: Resolve Workspace Variables

**AS A** developer using unireq in a workspace
**I WANT** `${var:name}` references in configs to resolve to workspace variable values
**SO THAT** I can reuse values across my configuration without duplication

**ACCEPTANCE:** `interpolate("${var:name}", context)` returns the variable value from `context.vars`

### US-2: Access Environment Variables

**AS A** developer deploying unireq in different environments
**I WANT** `${env:NAME}` references to resolve to environment variable values
**SO THAT** I can use environment-specific configuration without modifying files

**ACCEPTANCE:** `interpolate("${env:HOME}", context)` returns `process.env.HOME`

### US-3: Placeholder for Secrets

**AS A** developer using sensitive values
**I WANT** `${secret:name}` references to be recognized and delegated
**SO THAT** the secrets system can resolve them securely when implemented

**ACCEPTANCE:** Without a secret resolver, returns placeholder `<secret:name>`

---

## 2. Business Rules

### Variable Syntax

| Pattern | Description | Resolution |
|---------|-------------|------------|
| `${var:name}` | Workspace variable | `context.vars[name]` |
| `${env:NAME}` | Environment variable | `process.env[NAME]` |
| `${secret:name}` | Secret placeholder | Resolver or `<secret:name>` |
| `${prompt:name}` | Prompt placeholder | Resolver or `<prompt:name>` |

### Resolution Order

1. Parse template for `${type:name}` patterns
2. For each match, resolve based on type
3. If recursive reference detected, resolve recursively (max depth 10)
4. Replace all matches in string
5. Return interpolated result

### Error Conditions

| Condition | Error Type | Message |
|-----------|------------|---------|
| Variable not found | `VariableNotFoundError` | Variable 'name' not found in vars |
| Env var not found | `VariableNotFoundError` | Environment variable 'NAME' not defined |
| Circular reference | `CircularReferenceError` | Circular reference detected: a → b → a |
| Max depth exceeded | `MaxRecursionError` | Maximum recursion depth (10) exceeded |

### Pass-Through Cases (No Error)

- Unknown type: `${foo:bar}` → left as literal
- Invalid syntax: `${invalid}` → left as literal
- Escaped: `$${var:name}` → `${var:name}`
- Empty name: `${var:}` → left as literal

---

## 3. Technical Impact

### Files to Create

| File | Purpose |
|------|---------|
| `src/workspace/variables/types.ts` | Type definitions |
| `src/workspace/variables/errors.ts` | Custom error classes |
| `src/workspace/variables/parser.ts` | Regex parsing logic |
| `src/workspace/variables/resolver.ts` | Resolution engine |
| `src/workspace/variables/index.ts` | Public exports |

### Types

```typescript
interface InterpolationContext {
  vars: Record<string, string>;
  secretResolver?: (name: string) => string | Promise<string>;
  promptResolver?: (name: string) => string | Promise<string>;
}

interface VariableMatch {
  full: string;      // "${var:name}"
  type: string;      // "var"
  name: string;      // "name"
  start: number;     // position in string
  end: number;       // end position
}
```

### Public API

```typescript
// Main function
function interpolate(template: string, context: InterpolationContext): string;

// Async version for secret/prompt resolution
function interpolateAsync(template: string, context: InterpolationContext): Promise<string>;

// Parse without resolving (for validation)
function parseVariables(template: string): VariableMatch[];
```

---

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Resolve workspace variable

```gherkin
Given a template "${var:greeting}"
And context with vars { greeting: "Hello" }
When interpolate is called
Then the result is "Hello"
```

### Scenario 2: Resolve environment variable

```gherkin
Given a template "${env:USER}"
And process.env.USER is "alice"
When interpolate is called
Then the result is "alice"
```

### Scenario 3: Undefined workspace variable throws error

```gherkin
Given a template "${var:missing}"
And context with empty vars {}
When interpolate is called
Then VariableNotFoundError is thrown with message containing "missing"
```

### Scenario 4: Undefined env variable throws error

```gherkin
Given a template "${env:NONEXISTENT_VAR_12345}"
And that env var is not defined
When interpolate is called
Then VariableNotFoundError is thrown with message containing "NONEXISTENT_VAR_12345"
```

### Scenario 5: Recursive variable resolution

```gherkin
Given a template "${var:greeting}"
And context with vars { greeting: "${var:word} World", word: "Hello" }
When interpolate is called
Then the result is "Hello World"
```

### Scenario 6: Circular reference detection

```gherkin
Given a template "${var:a}"
And context with vars { a: "${var:b}", b: "${var:a}" }
When interpolate is called
Then CircularReferenceError is thrown with message containing "a → b → a"
```

### Scenario 7: Max recursion depth exceeded

```gherkin
Given a template "${var:v0}"
And context with vars creating chain v0 → v1 → ... → v11 (depth 11)
When interpolate is called
Then MaxRecursionError is thrown
```

### Scenario 8: Secret placeholder without resolver

```gherkin
Given a template "key: ${secret:apiKey}"
And context without secretResolver
When interpolate is called
Then the result is "key: <secret:apiKey>"
```

### Scenario 9: Prompt placeholder without resolver

```gherkin
Given a template "user: ${prompt:username}"
And context without promptResolver
When interpolate is called
Then the result is "user: <prompt:username>"
```

### Scenario 10: Multiple variables in one string

```gherkin
Given a template "${var:protocol}://${var:host}:${env:PORT}"
And context with vars { protocol: "https", host: "api.example.com" }
And process.env.PORT is "8080"
When interpolate is called
Then the result is "https://api.example.com:8080"
```

### Scenario 11: Unknown variable type left as literal

```gherkin
Given a template "${unknown:value}"
When interpolate is called
Then the result is "${unknown:value}"
```

### Scenario 12: Escaped variable syntax

```gherkin
Given a template "literal: $${var:name}"
When interpolate is called
Then the result is "literal: ${var:name}"
```

### Scenario 13: Empty string value is valid

```gherkin
Given a template "prefix${var:empty}suffix"
And context with vars { empty: "" }
When interpolate is called
Then the result is "prefixsuffix"
```

---

## 5. Implementation Plan

### Block 1: Types and Errors (Vertical Slice)

**Files:**
- `src/workspace/variables/types.ts`
- `src/workspace/variables/errors.ts`
- `src/workspace/variables/__tests__/errors.test.ts`

**Tasks:**
- Define `InterpolationContext`, `VariableMatch` interfaces
- Create `VariableNotFoundError`, `CircularReferenceError`, `MaxRecursionError`
- Unit tests for error creation and messages

**Acceptance criteria covered:** #3, #4, #6, #7

### Block 2: Parser (Vertical Slice)

**Files:**
- `src/workspace/variables/parser.ts`
- `src/workspace/variables/__tests__/parser.test.ts`

**Tasks:**
- Implement regex pattern for `${type:name}`
- `parseVariables(template)` function
- Handle escaped `$${...}` syntax
- Handle invalid/unknown types

**Acceptance criteria covered:** #11, #12

### Block 3: Resolver (Vertical Slice)

**Files:**
- `src/workspace/variables/resolver.ts`
- `src/workspace/variables/__tests__/resolver.test.ts`
- `src/workspace/variables/index.ts`

**Tasks:**
- Implement `interpolate(template, context)` synchronous version
- var/env resolution
- Placeholder handling for secret/prompt
- Recursive resolution with depth tracking
- Circular reference detection

**Acceptance criteria covered:** #1, #2, #5, #8, #9, #10, #13

### Block 4: Integration (Vertical Slice)

**Files:**
- `src/workspace/variables/__tests__/integration.test.ts`
- Update `src/workspace/index.ts` exports

**Tasks:**
- Integration tests with realistic configs
- Export public API from workspace module
- Update TODO_WORKSPACE.md

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| #1 var resolution | Yes | Yes |
| #2 env resolution | Yes | Yes |
| #3 var not found | Yes | - |
| #4 env not found | Yes | - |
| #5 recursive | Yes | Yes |
| #6 circular | Yes | - |
| #7 max depth | Yes | - |
| #8 secret placeholder | Yes | - |
| #9 prompt placeholder | Yes | - |
| #10 multiple vars | Yes | Yes |
| #11 unknown type | Yes | - |
| #12 escaped | Yes | - |
| #13 empty value | Yes | - |

### Test Data

```typescript
// Fixtures for common test cases
const testVars = {
  simple: { greeting: 'Hello' },
  recursive: { greeting: '${var:word} World', word: 'Hello' },
  circular: { a: '${var:b}', b: '${var:a}' },
  deepChain: Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`v${i}`, `\${var:v${i + 1}}`])
  ),
};
```

---

## Definition of Done

- [ ] All 4 blocks implemented
- [ ] All 13 BDD scenarios have passing tests
- [ ] All tests pass (unit + integration)
- [ ] Lint/typecheck pass
- [ ] Documentation updated
- [ ] TODO_WORKSPACE.md updated
