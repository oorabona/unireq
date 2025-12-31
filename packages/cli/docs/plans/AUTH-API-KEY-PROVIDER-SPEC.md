---
doc-meta:
  status: canonical
  scope: auth
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: API Key Provider (Task 4.2)

## 1. User Story

**AS A** CLI user with an API key
**I WANT** the CLI to resolve my api_key provider configuration
**SO THAT** it produces a ResolvedCredential ready for request injection

**ACCEPTANCE:** resolveApiKeyProvider returns correct ResolvedCredential

## 2. Business Rules

### BR-1: Resolution Mapping

- `config.location` maps directly to `credential.location`
- `config.name` maps directly to `credential.name`
- `config.value` is interpolated and becomes `credential.value`

### BR-2: Variable Interpolation

- Value field supports all variable types: `${var:...}`, `${env:...}`, `${secret:...}`, `${prompt:...}`
- Uses existing `interpolate()` from workspace/variables
- Propagates interpolation errors (VariableNotFoundError, etc.)

## 3. Technical Impact

| Layer | Changes |
|-------|---------|
| Auth Module | New `src/auth/providers/api-key.ts` |
| Exports | Update `src/auth/index.ts` |

## 4. Acceptance Criteria (BDD)

### Scenario 1: Direct value resolution

```gherkin
Given an api_key config with value "my-api-key"
When resolveApiKeyProvider is called
Then it returns ResolvedCredential with value "my-api-key"
```

### Scenario 2: Header location

```gherkin
Given an api_key config with location "header" and name "X-API-Key"
When resolveApiKeyProvider is called
Then ResolvedCredential has location "header" and name "X-API-Key"
```

### Scenario 3: Query location

```gherkin
Given an api_key config with location "query" and name "api_key"
When resolveApiKeyProvider is called
Then ResolvedCredential has location "query" and name "api_key"
```

### Scenario 4: Variable interpolation

```gherkin
Given an api_key config with value "${var:apiKey}"
And context.vars.apiKey = "resolved-key"
When resolveApiKeyProvider is called
Then ResolvedCredential has value "resolved-key"
```

### Scenario 5: Environment variable

```gherkin
Given an api_key config with value "${env:API_KEY}"
And process.env.API_KEY = "env-key"
When resolveApiKeyProvider is called
Then ResolvedCredential has value "env-key"
```

### Scenario 6: Secret placeholder

```gherkin
Given an api_key config with value "${secret:apiKey}"
And no secretResolver provided
When resolveApiKeyProvider is called
Then ResolvedCredential has value "<secret:apiKey>" (placeholder)
```

### Scenario 7: Missing variable error

```gherkin
Given an api_key config with value "${var:missing}"
And context.vars does not contain "missing"
When resolveApiKeyProvider is called
Then it throws VariableNotFoundError
```

## 5. Implementation Plan

### Block 1: API Key Provider Resolver

**Files:**
- `src/auth/providers/api-key.ts`
- `src/auth/providers/index.ts`
- `src/auth/index.ts` (update exports)
- `src/auth/providers/__tests__/api-key.test.ts`

**Complexity:** S
**Dependencies:** Task 4.1 (types), Task 2.4 (interpolation)

## 6. Definition of Done

- [x] resolveApiKeyProvider function implemented
- [x] All 7 BDD scenarios have passing tests
- [x] Exports updated in auth/index.ts
- [x] Lint/typecheck pass
