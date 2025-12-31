---
doc-meta:
  status: draft
  scope: secrets
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Secrets Documentation Index

## Overview

Secret management: OS keychain integration, encrypted vault fallback, secure credential storage.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/SECRETS-OVERVIEW.md) | design | draft | Scope overview and features |

## Backends (V1)

| Backend | Priority | Description |
|---------|----------|-------------|
| OS Keychain | 1 | Native credential store (if available) |
| Vault file | 2 | Encrypted local file (fallback) |

## Vault Implementation

- **Encryption:** AES-256-GCM (symmetric)
- **Key Derivation:** scrypt or argon2id from passphrase
- **Lock/Unlock:** REPL command for vault access

## File Structure

```
vault.enc           # Encrypted blob
vault.meta.json     # KDF metadata (non-secret)
```

## Vault Metadata Schema

```json
{
  "version": 1,
  "kdf": {
    "type": "scrypt",
    "saltB64": "...",
    "n": 16384,
    "r": 8,
    "p": 1,
    "keyLen": 32
  },
  "cipher": {
    "type": "aes-256-gcm",
    "nonceLen": 12
  }
}
```

## Configuration

```yaml
secrets:
  backend: auto       # auto|keychain|vault
  vault:
    kdf: scrypt       # scrypt|argon2id
    lockTimeoutMs: 900000  # 15 minutes
```

## Security Rules

- Never write tokens in clear in logs
- Auto-redaction of secrets in `--trace`
- Vault lock capability in REPL

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_SECRETS.md](../../TODO_SECRETS.md)
