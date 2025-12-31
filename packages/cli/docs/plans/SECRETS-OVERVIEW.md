---
doc-meta:
  status: draft
  scope: secrets
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# Secrets Overview

## Purpose

Secure credential management providing:
- OS keychain integration (when available)
- Encrypted vault fallback
- Secure storage for API keys, tokens, passwords
- REPL lock/unlock for vault access

## Key Features

### Backend Priority

| Priority | Backend | Description |
|----------|---------|-------------|
| 1 | OS Keychain | Native credential store |
| 2 | Vault file | Encrypted local file |

### Security Principles

- Never write tokens in clear in logs
- Auto-redaction in `--trace` output
- Vault lock capability in REPL
- KDF for passphrase-derived keys

## Target Users

- Developers storing API credentials
- Teams needing portable secret storage
- Users without keychain access

## Configuration

```yaml
secrets:
  backend: auto       # auto|keychain|vault
  vault:
    kdf: scrypt       # scrypt|argon2id
    lockTimeoutMs: 900000  # 15 minutes auto-lock
```

## Keychain Integration

| OS | Backend |
|----|---------|
| macOS | Keychain Services |
| Windows | Credential Manager |
| Linux | Secret Service API (libsecret) |

## Vault Implementation

### Encryption

- **Algorithm:** AES-256-GCM
- **Key derivation:** scrypt or argon2id
- **Nonce:** 12 bytes random per encryption

### Files

```
~/.config/unireq/
├── vault.enc         # Encrypted secrets blob
└── vault.meta.json   # KDF parameters (non-secret)
```

### Metadata Schema

```json
{
  "version": 1,
  "kdf": {
    "type": "scrypt",
    "saltB64": "base64-encoded-salt",
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

## REPL Commands

| Command | Description |
|---------|-------------|
| `vault lock` | Lock vault (require passphrase) |
| `vault unlock` | Unlock vault |
| `vault status` | Show lock state |

## Secret References

| Syntax | Description |
|--------|-------------|
| `${secret:name}` | Reference stored secret |
| `${prompt:name}` | Prompt user (not stored) |

## Security Considerations

- Vault passphrase never stored
- Memory cleared after use
- Auto-lock timeout
- No native dependencies required (pure JS fallback)

## Open Questions

- [ ] Keychain library choice (keytar vs native bindings)
- [ ] Vault migration strategy
- [ ] Multi-user vault sharing

## Next Steps

1. Run `/clarify secrets` to detail requirements
2. Run `/spec secrets-vault` for vault implementation
3. Run `/spec secrets-keychain` for OS integration
