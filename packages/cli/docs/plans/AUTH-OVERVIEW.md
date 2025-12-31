---
doc-meta:
  status: draft
  scope: auth
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# Auth Overview

## Purpose

Authentication management providing:
- Declarative auth flow configuration
- Multiple provider types (API key, Bearer, JWT, OAuth2)
- Automatic token injection
- Credential storage integration

## Key Features

### Pain Points Addressed

| Problem | Solution |
|---------|----------|
| Manual login → token extraction | Automated with `login_jwt` provider |
| Token refresh management | Auto-refresh on 401 (V2) |
| Headers/cookies maintenance | Automatic injection |
| Multi-step auth sequences | Declarative flow config |

### Provider Model

- **Auth provider:** Declarative description of auth flow
- **Credentials:** Secure storage (keychain or vault)
- **Injection:** Automatic header/query/cookie insertion

## Target Users

- Developers working with authenticated APIs
- QA testing auth flows
- DevOps scripting authenticated requests

## Commands

```
unireq auth login <provider>
unireq auth status
unireq auth logout [--all]
```

## Provider Types (V1)

### API Key

```yaml
type: api_key
apiKey:
  location: header  # or: query
  name: X-API-Key
  value: "${secret:apiKey}"
```

### Bearer Token

```yaml
type: bearer
token: "${secret:token}"
```

### Login → JWT

```yaml
type: login_jwt
login:
  method: POST
  url: /auth/login
  body:
    username: "${prompt:username}"
    password: "${secret:password}"
extract:
  token: "$.token"
  refreshToken: "$.refreshToken?"  # optional
inject:
  header: Authorization
  format: "Bearer ${token}"
```

### OAuth2 Client Credentials

```yaml
type: oauth2_client_credentials
tokenUrl: https://idp.example.com/oauth/token
clientId: "${secret:clientId}"
clientSecret: "${secret:clientSecret}"
scope: "api.read api.write"
audience: "${var:audience}?"
inject:
  header: Authorization
  format: "Bearer ${accessToken}"
```

## Provider Types (V2)

| Type | Description |
|------|-------------|
| `oauth2_pkce` | Authorization code + PKCE |
| `oauth2_refresh` | Refresh token handling |
| `oauth2_device_code` | Device authorization flow |
| `custom` | Multi-step declarative flows |

## Variable Interpolation

| Syntax | Description |
|--------|-------------|
| `${secret:name}` | From secure storage |
| `${prompt:name}` | Interactive prompt |
| `${var:name}` | From workspace variables |
| `${env:NAME}` | From environment |

## Open Questions

- [ ] Token caching strategy
- [ ] Clock skew tolerance
- [ ] Multi-provider chaining

## Next Steps

1. Run `/clarify auth` to detail requirements
2. Run `/spec auth-providers` for provider implementation
3. Run `/spec auth-injection` for header injection
