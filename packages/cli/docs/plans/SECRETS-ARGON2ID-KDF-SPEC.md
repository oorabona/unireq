---
doc-meta:
  status: canonical
  scope: secrets
  type: specification
  created: 2026-01-01
  updated: 2026-01-01
---

# Specification: Argon2id KDF (Task 6.3)

## 1. User Stories

### US-1: Secure Key Derivation for New Vaults

**AS A** developer using @unireq/cli vault
**I WANT** Argon2id as the key derivation function for new vaults
**SO THAT** the vault meets the 2025 cryptographic baseline (OWASP/NIST)

**ACCEPTANCE:** New vaults use Argon2id with recommended parameters; existing scrypt vaults continue to work

---

## 2. Business Rules

### Argon2id Parameters (OWASP 2025)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Memory (m) | 65536 KB (64 MB) | Memory cost |
| Iterations (t) | 3 | Time cost |
| Parallelism (p) | 4 | Degree of parallelism |
| Output length | 32 bytes | For AES-256 key |
| Salt length | 16 bytes | Random per vault |

### Vault Versioning

| Version | KDF Algorithm | Metadata Field |
|---------|---------------|----------------|
| 1 | scrypt | `scrypt: ScryptParams` |
| 2 | argon2id | `argon2id: Argon2idParams` |

### Backward Compatibility

- Version 1 vaults MUST continue to work (scrypt)
- New vaults MUST use version 2 (argon2id)
- No automatic migration (out of scope)

---

## 3. Technical Impact

| Layer | Changes | Validation |
|-------|---------|------------|
| Dependencies | Add @node-rs/argon2 | Package installs |
| Types | Argon2idParams, updated VaultMetadata | TypeScript compiles |
| KDF Module | kdf-argon2.ts with deriveKeyArgon2id() | Unit tests pass |
| Vault | Version 2 support, algorithm detection | Integration tests pass |

---

## 4. Acceptance Criteria (BDD Scenarios)

### S-1: New Vault Uses Argon2id

```gherkin
Scenario: Initialize new vault
  Given vault does not exist
  When user initializes vault with passphrase "test123"
  Then vault metadata version is 2
  And vault metadata contains argon2id params
  And key is derived using Argon2id
```

### S-2: Argon2id Key Derivation

```gherkin
Scenario: Derive key with Argon2id
  Given passphrase "my-secret" and random salt
  When deriveKeyArgon2id is called with default params
  Then returned key is 32 bytes
  And same passphrase+salt produces same key
  And different passphrase produces different key
```

### S-3: Backward Compatibility with Scrypt

```gherkin
Scenario: Unlock existing scrypt vault
  Given vault with version 1 (scrypt) exists
  When user unlocks with correct passphrase
  Then vault unlocks successfully using scrypt KDF
  And vault contents are accessible
```

### S-4: Algorithm Detection

```gherkin
Scenario: Detect KDF algorithm from metadata
  Given vault metadata with version 2
  When vault loads metadata
  Then Argon2id KDF is selected
  And scrypt is not used
```

### S-5: Error Handling

```gherkin
Scenario: Invalid passphrase with Argon2id
  Given vault with version 2 exists
  When user attempts unlock with wrong passphrase
  Then InvalidPassphraseError is thrown
  And vault remains locked
```

---

## 5. Implementation Plan

### Block 1: Argon2id KDF Module

**Packages:** cli

**Files:**
- `package.json` (MODIFY - add @node-rs/argon2)
- `src/secrets/types.ts` (MODIFY - add Argon2idParams, update VaultMetadata)
- `src/secrets/kdf-argon2.ts` (NEW)
- `src/secrets/__tests__/kdf-argon2.test.ts` (NEW)

**Deliverables:**
- Add @node-rs/argon2 dependency
- Argon2idParams interface with defaults
- deriveKeyArgon2id() function
- generateSaltArgon2() function (same as scrypt, reuse)
- Unit tests for Argon2id KDF

**Acceptance criteria covered:** S-2

**Complexity:** S
**Dependencies:** None

### Block 2: Vault Version 2 Integration

**Packages:** cli

**Files:**
- `src/secrets/vault.ts` (MODIFY)
- `src/secrets/__tests__/vault.test.ts` (MODIFY)

**Deliverables:**
- Update VaultMetadata type for version 2
- Algorithm detection in unlock()
- Use Argon2id for initialize() (version 2)
- Keep scrypt support for version 1
- Integration tests for both versions

**Acceptance criteria covered:** S-1, S-3, S-4, S-5

**Complexity:** M
**Dependencies:** Block 1

---

## 6. Test Strategy

### Test Matrix

| Scenario | Unit | Integration |
|----------|------|-------------|
| S-1: New vault uses Argon2id | - | Yes |
| S-2: Argon2id key derivation | Yes | - |
| S-3: Backward compat (scrypt) | - | Yes |
| S-4: Algorithm detection | Yes | Yes |
| S-5: Error handling | Yes | - |

### Test Structure

**Unit tests (AAA pattern):**
- deriveKeyArgon2id produces consistent keys
- deriveKeyArgon2id produces correct length
- Different passwords produce different keys
- Custom params are respected

**Integration tests (GWT pattern):**
- Initialize vault → metadata has version 2
- Unlock version 1 vault → uses scrypt
- Unlock version 2 vault → uses argon2id
- Invalid passphrase → error thrown

---

## Definition of Done

- [ ] @node-rs/argon2 added to devDependencies
- [ ] Argon2idParams interface defined
- [ ] deriveKeyArgon2id() implemented
- [ ] VaultMetadata updated for version 2
- [ ] Vault uses Argon2id for new vaults
- [ ] Scrypt backward compatibility preserved
- [ ] Unit tests pass (10+ tests)
- [ ] Integration tests pass
- [ ] Lint/typecheck pass
- [ ] TODO_SECRETS.md updated
