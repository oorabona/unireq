---
doc-meta:
  status: canonical
  scope: secrets
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: OS Keychain Integration (Task 6.4)

## 1. User Stories

### US-1: Native Keychain Storage

**AS A** developer using @unireq/cli
**I WANT** secrets to be stored in the OS native keychain when available
**SO THAT** I don't need to manage vault passphrases and have better security integration

**ACCEPTANCE:** Secrets stored/retrieved from OS keychain; vault used as fallback

---

## 2. Business Rules

### Backend Priority

| Priority | Backend | Condition |
|----------|---------|-----------|
| 1 | Keychain | keyring-node loads AND config != 'vault' |
| 2 | Vault | Fallback or config == 'vault' |

### Configuration

```yaml
secrets:
  backend: auto       # auto | keychain | vault
```

| Value | Behavior |
|-------|----------|
| `auto` (default) | Try keychain first, fallback to vault |
| `keychain` | Force keychain, error if unavailable |
| `vault` | Force vault, ignore keychain |

### Keyring-node Service/Account

| Field | Value |
|-------|-------|
| Service | `unireq-cli` |
| Account | `<secret-name>` |

### Error Handling

| Situation | Behavior |
|-----------|----------|
| keyring-node fails to import | Silent fallback to vault (optionalDependency) |
| Keychain locked (OS) | Silent fallback to vault |
| Keychain permission denied | Silent fallback to vault |
| libsecret not installed (Linux) | Silent fallback to vault |
| config=keychain but unavailable | Throw KeychainUnavailableError |

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Dependencies | Add keyring-node (optional) | Package installs |
| Types | ISecretBackend interface | TypeScript compiles |
| Backend: Keychain | KeychainBackend class | Unit tests pass |
| Backend: Vault | VaultBackend wrapper | Unit tests pass |
| Resolver | SecretResolver (auto-detect) | Integration tests pass |
| Commands | Use SecretResolver | E2E tests pass |
| Config | secrets.backend option | Config tests pass |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: Keychain Available - Set Secret

```gherkin
Scenario: Set secret when keychain is available
  Given keychain backend is active
  And secret "api-key" does not exist
  When user runs "secret set api-key my-secret-value"
  Then secret is stored in OS keychain
  And success message is displayed
```

### S-2: Keychain Available - Get Secret

```gherkin
Scenario: Get secret when keychain is available
  Given keychain backend is active
  And secret "api-key" exists with value "my-secret-value"
  When user runs "secret get api-key"
  Then value "my-secret-value" is returned
```

### S-3: Keychain Unavailable - Fallback to Vault

```gherkin
Scenario: Fallback to vault when keychain unavailable
  Given keyring-node fails to load (native bindings missing)
  And vault is initialized with passphrase
  When user runs "secret set api-key my-secret-value"
  Then secret is stored in vault
  And info message indicates vault fallback
```

### S-4: Config Forces Vault

```gherkin
Scenario: Force vault backend via config
  Given config has "secrets.backend: vault"
  And keychain is available
  When user runs "secret set api-key my-secret-value"
  Then secret is stored in vault (not keychain)
```

### S-5: Config Forces Keychain - Unavailable

```gherkin
Scenario: Error when keychain forced but unavailable
  Given config has "secrets.backend: keychain"
  And keychain is NOT available
  When user runs "secret set api-key my-secret-value"
  Then KeychainUnavailableError is thrown
```

### S-6: List Secrets from Keychain

```gherkin
Scenario: List all secrets from keychain
  Given keychain backend is active
  And secrets "foo", "bar", "baz" exist in keychain
  When user runs "secret list"
  Then all three secrets are listed
```

### S-7: Delete Secret from Keychain

```gherkin
Scenario: Delete secret from keychain
  Given keychain backend is active
  And secret "api-key" exists
  When user runs "secret delete api-key"
  Then secret is removed from keychain
  And secret get "api-key" returns undefined
```

### S-8: Status Shows Backend

```gherkin
Scenario: Status shows active backend
  Given keychain backend is active
  When user runs "secret status"
  Then output shows "Backend: keychain"
```

---

## 5. Implementation Plan

### Block 1: Types and Backend Interface

**Packages:** cli

**Files:**
- `src/secrets/backend-types.ts` (NEW)
- `src/secrets/types.ts` (MODIFY - add KeychainUnavailableError)

**Deliverables:**
- ISecretBackend interface (get, set, delete, list, isAvailable)
- BackendType enum ('keychain' | 'vault')
- KeychainUnavailableError class
- SecretBackendConfig type

**Acceptance criteria covered:** (foundation for all)

**Complexity:** S
**Dependencies:** None

### Block 2: Keychain Backend

**Packages:** cli

**Files:**
- `package.json` (MODIFY - add keyring-node as optionalDependency)
- `src/secrets/backend-keychain.ts` (NEW)
- `src/secrets/__tests__/backend-keychain.test.ts` (NEW)

**Deliverables:**
- KeychainBackend class implementing ISecretBackend
- Dynamic import of keyring-node with graceful failure
- Entry class usage (service: unireq-cli, account: <name>)
- isAvailable() check
- Unit tests with mocked keyring-node

**Acceptance criteria covered:** S-1, S-2, S-6, S-7

**Complexity:** M
**Dependencies:** Block 1

### Block 3: Vault Backend Wrapper

**Packages:** cli

**Files:**
- `src/secrets/backend-vault.ts` (NEW)
- `src/secrets/__tests__/backend-vault.test.ts` (NEW)

**Deliverables:**
- VaultBackend class implementing ISecretBackend
- Wraps existing Vault class
- Delegate to vault.get/set/delete/list
- isAvailable() always true (vault is always available)
- Unit tests

**Acceptance criteria covered:** S-3, S-4

**Complexity:** S
**Dependencies:** Block 1

### Block 4: Secret Resolver

**Packages:** cli

**Files:**
- `src/secrets/resolver.ts` (MODIFY - enhance existing or NEW)
- `src/secrets/__tests__/resolver.test.ts` (MODIFY)
- `src/workspace/schema.ts` (MODIFY - add secrets.backend config)

**Deliverables:**
- SecretResolver class or factory
- Auto-detection logic (keychain → vault fallback)
- Config-based backend selection
- getActiveBackend() method
- getBackendName() for status display
- Config schema extension

**Acceptance criteria covered:** S-3, S-4, S-5, S-8

**Complexity:** M
**Dependencies:** Block 2, Block 3

### Block 5: Command Integration

**Packages:** cli

**Files:**
- `src/secrets/commands.ts` (MODIFY)
- `src/secrets/__tests__/commands.test.ts` (MODIFY)

**Deliverables:**
- Update secret commands to use SecretResolver
- Show backend in status command
- Handle KeychainUnavailableError gracefully
- Integration tests

**Acceptance criteria covered:** All S-1 through S-8

**Complexity:** M
**Dependencies:** Block 4

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: Set secret (keychain) | Yes | Yes |
| S-2: Get secret (keychain) | Yes | Yes |
| S-3: Fallback to vault | Yes | Yes |
| S-4: Config forces vault | Yes | Yes |
| S-5: Config forces keychain - error | Yes | - |
| S-6: List secrets | Yes | Yes |
| S-7: Delete secret | Yes | Yes |
| S-8: Status shows backend | Yes | Yes |

### Mocking Strategy

- **keyring-node:** Mock in unit tests (native bindings may not be available in CI)
- **Vault:** Use real temp directory for integration tests
- **Config:** Mock workspace config in unit tests

### Test Structure

**Unit tests (AAA pattern):**
- KeychainBackend.get returns secret
- KeychainBackend.set stores secret
- KeychainBackend.isAvailable returns false when import fails
- VaultBackend delegates to Vault
- SecretResolver selects correct backend

**Integration tests (GWT pattern):**
- Given keychain mock → When set → Then stored
- Given config vault → When set → Then vault used
- Given keychain unavailable → When set → Then fallback

---

## Definition of Done

- [x] @napi-rs/keyring added as optionalDependency ✅ 2026-01-01
- [x] ISecretBackend interface defined ✅ 2026-01-01
- [x] KeychainBackend implemented ✅ 2026-01-01
- [x] VaultBackend wrapper implemented ✅ 2026-01-01
- [x] SecretBackendResolver with auto-detection ✅ 2026-01-01
- [x] secrets.backend config option ✅ 2026-01-01
- [x] Commands use SecretBackendResolver ✅ 2026-01-01
- [x] Unit tests pass (93 new tests) ✅ 2026-01-01
- [x] All 2700 tests pass ✅ 2026-01-01
- [x] Lint/typecheck pass ✅ 2026-01-01
- [x] TODO_SECRETS.md updated ✅ 2026-01-01
