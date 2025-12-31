---
doc-meta:
  status: canonical
  scope: auth
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: Auth Provider Model and Types (Task 4.1)

## 1. User Stories

### US-1: Define Auth Provider Types

**AS A** CLI developer implementing auth features
**I WANT** typed provider configurations with validation
**SO THAT** I can implement specific providers consistently

**ACCEPTANCE:** Each provider type has a validated schema with required fields

### US-2: Manage Auth Providers

**AS A** CLI user configuring authentication
**I WANT** to define multiple auth providers in workspace.yaml
**SO THAT** I can switch between different auth methods

**ACCEPTANCE:** Provider registry can list, get, and validate providers

### US-3: Prepare for Header Injection

**AS A** CLI developer implementing request execution
**I WANT** a clear credential output type
**SO THAT** I know what to inject into requests

**ACCEPTANCE:** ResolvedCredential type defines header/query/cookie injection

## 2. Business Rules

### BR-1: Provider Type Discrimination

- Each provider config MUST have a `type` field
- Valid types for V1: `api_key`, `bearer`, `login_jwt`, `oauth2_client_credentials`
- Unknown types MUST fail validation with list of valid types

### BR-2: Provider-Specific Validation

#### api_key Provider
- MUST have `location`: `header` | `query`
- MUST have `name`: string (header/query param name)
- MUST have `value`: string (the API key, usually `${secret:...}`)

#### bearer Provider
- MUST have `token`: string (the token, usually `${secret:...}`)
- MAY have `prefix`: string (default: `Bearer`)

#### login_jwt Provider
- MUST have `login.method`: HTTP method
- MUST have `login.url`: string (login endpoint)
- MUST have `login.body`: object (credentials payload)
- MUST have `extract.token`: string (JSONPath to token)
- MAY have `extract.refreshToken`: string (JSONPath, optional)
- MUST have `inject`: injection config

#### oauth2_client_credentials Provider
- MUST have `tokenUrl`: valid URL
- MUST have `clientId`: string
- MUST have `clientSecret`: string
- MAY have `scope`: string (space-separated scopes)
- MAY have `audience`: string
- MUST have `inject`: injection config

### BR-3: Injection Configuration

- `inject.location`: `header` | `query` | `cookie` (default: `header`)
- `inject.name`: string (default: `Authorization` for header)
- `inject.format`: string template with `${token}` (default: `Bearer ${token}`)

### BR-4: Active Provider

- `auth.active` specifies which provider is currently active
- If not set, first provider is used (or none if empty)
- Active provider name MUST exist in providers map

### BR-5: Credential Resolution

- ResolvedCredential represents ready-to-inject values
- Contains: location, name, value (all strings, already interpolated)
- Providers return ResolvedCredential when authentication succeeds

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Schema | Provider type schemas in schema.ts | Valibot discriminated union |
| Types | Provider interfaces in types.ts | TypeScript compile-time |
| Auth Module | New `src/auth/` directory | Unit tests |
| Workspace | Update authProviderSchema | Integration with loader |

### New Module Structure

```
src/auth/
├── index.ts           # Exports
├── types.ts           # Provider interfaces, ResolvedCredential
├── schema.ts          # Valibot schemas per provider type
├── registry.ts        # Provider registry functions
└── __tests__/
    ├── schema.test.ts
    └── registry.test.ts
```

## 4. Acceptance Criteria (BDD Scenarios)

### Scenario 1: Parse api_key provider

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      main:
        type: api_key
        location: header
        name: X-API-Key
        value: "${secret:apiKey}"
  """
When the config is parsed
Then validation succeeds
And provider "main" has type "api_key"
And provider "main" has location "header"
```

### Scenario 2: Parse bearer provider

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      token:
        type: bearer
        token: "${secret:token}"
  """
When the config is parsed
Then validation succeeds
And provider "token" has type "bearer"
```

### Scenario 3: Parse login_jwt provider

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      api:
        type: login_jwt
        login:
          method: POST
          url: /auth/login
          body:
            username: "${prompt:username}"
            password: "${secret:password}"
        extract:
          token: "$.token"
        inject:
          location: header
          name: Authorization
          format: "Bearer ${token}"
  """
When the config is parsed
Then validation succeeds
And provider "api" has type "login_jwt"
And provider "api" has login.method "POST"
```

### Scenario 4: Parse oauth2_client_credentials provider

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      machine:
        type: oauth2_client_credentials
        tokenUrl: https://auth.example.com/oauth/token
        clientId: "${secret:clientId}"
        clientSecret: "${secret:clientSecret}"
        scope: "api.read api.write"
        inject:
          location: header
          format: "Bearer ${token}"
  """
When the config is parsed
Then validation succeeds
And provider "machine" has type "oauth2_client_credentials"
And provider "machine" has tokenUrl "https://auth.example.com/oauth/token"
```

### Scenario 5: Reject unknown provider type

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      unknown:
        type: magic_auth
  """
When the config is parsed
Then validation fails
And error message contains "Invalid provider type"
And error message lists valid types
```

### Scenario 6: Reject api_key missing required fields

```gherkin
Given a workspace config with auth provider:
  """
  auth:
    providers:
      incomplete:
        type: api_key
        location: header
  """
When the config is parsed
Then validation fails
And error message indicates "name" is required
```

### Scenario 7: Get provider from registry

```gherkin
Given a parsed workspace config with providers "dev" and "prod"
When getProvider("dev") is called
Then it returns the "dev" provider config
When getProvider("unknown") is called
Then it returns undefined
```

### Scenario 8: List all providers

```gherkin
Given a parsed workspace config with providers "dev", "staging", "prod"
When listProviders() is called
Then it returns ["dev", "staging", "prod"]
```

### Scenario 9: Get active provider

```gherkin
Given a workspace config with:
  """
  auth:
    active: staging
    providers:
      dev: { type: bearer, token: "dev-token" }
      staging: { type: bearer, token: "staging-token" }
  """
When getActiveProvider() is called
Then it returns the "staging" provider config
```

### Scenario 10: Default active provider

```gherkin
Given a workspace config with no active set:
  """
  auth:
    providers:
      first: { type: bearer, token: "t1" }
      second: { type: bearer, token: "t2" }
  """
When getActiveProvider() is called
Then it returns the first provider ("first")
```

### Scenario 11: Empty providers

```gherkin
Given a workspace config with no providers:
  """
  auth:
    providers: {}
  """
When listProviders() is called
Then it returns empty array
When getActiveProvider() is called
Then it returns undefined
```

## 5. Implementation Plan

### Block 1: Provider Types and Schemas

**Packages:** cli

**Vertical slice:** Types + Valibot schemas + validation tests

- Create `src/auth/types.ts`:
  - `AuthProviderType` union: `'api_key' | 'bearer' | 'login_jwt' | 'oauth2_client_credentials'`
  - `ApiKeyProviderConfig`, `BearerProviderConfig`, `LoginJwtProviderConfig`, `OAuth2ClientCredentialsConfig`
  - `AuthProviderConfig` discriminated union
  - `InjectionConfig` interface
  - `ResolvedCredential` interface

- Create `src/auth/schema.ts`:
  - `injectionConfigSchema`
  - `apiKeyProviderSchema`
  - `bearerProviderSchema`
  - `loginJwtProviderSchema`
  - `oauth2ClientCredentialsSchema`
  - `authProviderConfigSchema` (discriminated union)

- Create `src/auth/__tests__/schema.test.ts`:
  - Tests for each provider type validation
  - Tests for missing required fields
  - Tests for invalid type rejection

**Files:**
- `src/auth/types.ts`
- `src/auth/schema.ts`
- `src/auth/__tests__/schema.test.ts`

**Acceptance criteria covered:** #1, #2, #3, #4, #5, #6

**Complexity:** M
**Dependencies:** None

### Block 2: Provider Registry

**Packages:** cli

**Vertical slice:** Registry functions + tests

- Create `src/auth/registry.ts`:
  - `listProviders(config: AuthConfig): string[]`
  - `getProvider(config: AuthConfig, name: string): AuthProviderConfig | undefined`
  - `getActiveProvider(config: AuthConfig): AuthProviderConfig | undefined`
  - `getActiveProviderName(config: AuthConfig): string | undefined`

- Create `src/auth/__tests__/registry.test.ts`:
  - Tests for list, get, getActive
  - Tests for empty providers
  - Tests for default active (first provider)

**Files:**
- `src/auth/registry.ts`
- `src/auth/__tests__/registry.test.ts`

**Acceptance criteria covered:** #7, #8, #9, #10, #11

**Complexity:** S
**Dependencies:** Block 1

### Block 3: Integration with Workspace Schema

**Packages:** cli

**Vertical slice:** Update workspace schema + integration tests

- Update `src/workspace/config/schema.ts`:
  - Import and use proper `authProviderConfigSchema`
  - Keep backward compatible with looseObject

- Create `src/auth/index.ts`:
  - Export all types and functions

- Update existing schema tests if needed

**Files:**
- `src/workspace/config/schema.ts` (update)
- `src/auth/index.ts`
- `src/workspace/config/__tests__/schema.test.ts` (update if needed)

**Acceptance criteria covered:** All (integration)

**Complexity:** S
**Dependencies:** Block 1, Block 2

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| api_key validation | Yes | Yes |
| bearer validation | Yes | Yes |
| login_jwt validation | Yes | Yes |
| oauth2_cc validation | Yes | Yes |
| Unknown type rejection | Yes | - |
| Missing field rejection | Yes | - |
| Registry list | Yes | - |
| Registry get | Yes | - |
| Registry active | Yes | - |
| Workspace integration | - | Yes |

### Test Data Strategy

```yaml
# Fixtures for testing
fixtures:
  valid_api_key:
    type: api_key
    location: header
    name: X-API-Key
    value: "test-key"

  valid_bearer:
    type: bearer
    token: "test-token"

  valid_login_jwt:
    type: login_jwt
    login:
      method: POST
      url: /auth/login
      body:
        username: user
        password: pass
    extract:
      token: "$.token"
    inject:
      location: header
      name: Authorization
      format: "Bearer ${token}"

  valid_oauth2_cc:
    type: oauth2_client_credentials
    tokenUrl: https://auth.example.com/token
    clientId: client-id
    clientSecret: client-secret
    inject:
      location: header
```

---

## Definition of Done

- [ ] Provider type interfaces defined in types.ts
- [ ] Valibot schemas for all 4 provider types
- [ ] Discriminated union schema for provider config
- [ ] Registry functions: listProviders, getProvider, getActiveProvider
- [ ] All BDD scenarios have passing tests
- [ ] Workspace schema updated to use proper provider schemas
- [ ] Lint/typecheck pass
- [ ] Documentation updated
