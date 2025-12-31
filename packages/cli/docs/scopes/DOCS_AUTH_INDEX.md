---
doc-meta:
  status: draft
  scope: auth
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Auth Documentation Index

## Overview

Authentication providers: declarative auth flow description, credential management, automatic token injection.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/AUTH-OVERVIEW.md) | design | draft | Scope overview and features |

## Key Commands

| Command | Description |
|---------|-------------|
| `unireq auth login <provider>` | Authenticate with provider |
| `unireq auth status` | Show current auth state |
| `unireq auth logout [--all]` | Clear tokens |

## Provider Types (V1)

| Type | Description |
|------|-------------|
| `api_key` | API Key in header or query |
| `bearer` | Static Bearer token |
| `login_jwt` | Login form → JWT extraction |
| `oauth2_client_credentials` | OAuth2 client credentials flow |

## Provider Types (V2)

- `oauth2_pkce` - Authorization code + PKCE
- `oauth2_refresh` - Refresh token handling
- `oauth2_device_code` - Device authorization flow
- `custom` - Multi-step declarative flows

## Configuration Example

```yaml
auth:
  active: main
  providers:
    main:
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
        header: Authorization
        format: "Bearer ${token}"
```

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_AUTH.md](../../TODO_AUTH.md)
