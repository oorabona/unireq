---
doc-meta:
  status: canonical
  scope: collections
  type: guide
  created: 2026-01-07
  updated: 2026-01-07
---

# Postman to Unireq Migration Guide

This guide helps you migrate from Postman to unireq, covering collection import, concept mapping, and workflow adaptation.

## Quick Start

```bash
# Import your Postman collection
unireq
> collection-import ./my-collection.postman_collection.json

# Verify import
> run my-collection/<request-id>
```

## What Gets Imported

| Postman Feature | Unireq Equivalent | Notes |
|-----------------|-------------------|-------|
| Collections | Collections | Direct mapping |
| Requests (method, URL, headers, body) | Saved requests | Full support |
| Folders | Nested collections | Folder names become collection IDs |
| Variables `{{var}}` | Variables `${var}` | Auto-converted |
| Query parameters | Query parameters | Preserved |
| Request body (JSON, form, raw) | Request body | Full support |
| Request descriptions | Descriptions | Preserved |

## What Requires Manual Setup

| Postman Feature | Unireq Alternative | Migration Path |
|-----------------|-------------------|----------------|
| Environments | Profiles | Create profiles manually |
| Global variables | Workspace variables | Define in workspace.yaml |
| Pre-request scripts | Variable extraction | Use `extract` command |
| Test scripts | Assertions | Use declarative assertions |
| Authentication | Auth providers | Configure auth manually |
| Collection variables | Profile variables | Move to profile |

---

## Concept Mapping

### Environments → Profiles

**Postman Environments** are replaced by **unireq Profiles**.

#### Postman

```
Environment: "Production"
- baseUrl: https://api.prod.example.com
- apiKey: secret-prod-key

Environment: "Development"
- baseUrl: https://api.dev.example.com
- apiKey: secret-dev-key
```

#### Unireq

```yaml
# workspace.yaml
profiles:
  prod:
    baseUrl: https://api.prod.example.com
    variables:
      apiKey: ${secret:api-key-prod}

  dev:
    baseUrl: https://api.dev.example.com
    variables:
      apiKey: ${secret:api-key-dev}
```

**Commands:**
```bash
# Switch profile (like changing environment)
profile use prod

# Show current profile
profile show
```

### Variables Syntax

| Postman | Unireq | Example |
|---------|--------|---------|
| `{{baseUrl}}` | `${baseUrl}` | Auto-converted on import |
| `{{$randomInt}}` | Not supported | Use actual values |
| `{{$guid}}` | Not supported | Use actual values |
| `{{$timestamp}}` | Not supported | Use actual values |

**Note:** Dynamic variables (`$randomInt`, `$guid`, `$timestamp`) are not supported. Replace with actual test values or extract from responses.

### Globals → Workspace Variables

**Postman Globals** become **workspace-level variables** in unireq.

```yaml
# workspace.yaml
variables:
  apiVersion: v1
  defaultTimeout: 5000
```

### Collection Variables → Profile Variables

**Postman Collection Variables** should be moved to profiles or workspace variables.

```yaml
# workspace.yaml
profiles:
  default:
    variables:
      collectionVar1: value1
      collectionVar2: value2
```

---

## Pre-Request Scripts → Variable Extraction

Postman's pre-request scripts often set up dynamic values. In unireq, use **response extraction** and **assertions** instead.

### Example: Getting an Auth Token First

#### Postman (Pre-request Script)

```javascript
// Pre-request script
pm.sendRequest({
  url: pm.environment.get('authUrl'),
  method: 'POST',
  body: { username: 'user', password: 'pass' }
}, (err, res) => {
  pm.environment.set('authToken', res.json().token);
});
```

#### Unireq (Sequential Extraction)

```bash
# Step 1: Login and extract token
> run auth/login
> extract authToken $.token

# Step 2: Use token in next request (auto-injected)
> run users/list

# Or save to collection with extraction defined
```

**Collection definition with extraction:**
```yaml
collections:
  - id: auth
    items:
      - id: login
        method: POST
        path: /auth/login
        body:
          username: "${username}"
          password: "${password}"
        extract:
          authToken: "$.token"
          userId: "$.user.id"
```

---

## Test Scripts → Assertions

Postman's test scripts are replaced by **declarative assertions** in unireq.

### Example: Checking Response

#### Postman (Test Script)

```javascript
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Response has users array", () => {
  const json = pm.response.json();
  pm.expect(json.users).to.be.an('array');
});

pm.test("User has name", () => {
  const json = pm.response.json();
  pm.expect(json.users[0].name).to.exist;
});
```

#### Unireq (Declarative Assertions)

```yaml
collections:
  - id: users
    items:
      - id: list
        method: GET
        path: /users
        assert:
          status: 200
          jsonPath:
            - path: "$.users"
              exists: true
            - path: "$.users[0].name"
              exists: true
```

### Assertion Comparison

| Postman Test | Unireq Assertion |
|--------------|------------------|
| `pm.response.to.have.status(200)` | `status: 200` |
| `pm.response.to.have.header("Content-Type")` | `header: { name: Content-Type, exists: true }` |
| `pm.expect(json.field).to.eql("value")` | `jsonPath: { path: "$.field", equals: "value" }` |
| `pm.expect(body).to.include("text")` | `contains: "text"` |
| `pm.expect(json.arr).to.have.lengthOf(3)` | Not directly supported |

---

## Authentication Migration

### API Key

#### Postman

```
Authorization Type: API Key
Key: X-API-Key
Value: {{apiKey}}
Add to: Header
```

#### Unireq

```yaml
# workspace.yaml
profiles:
  default:
    auth:
      type: apiKey
      header: X-API-Key
      value: ${secret:api-key}
```

### Bearer Token

#### Postman

```
Authorization Type: Bearer Token
Token: {{accessToken}}
```

#### Unireq

```yaml
profiles:
  default:
    auth:
      type: bearer
      token: ${secret:access-token}
```

### Basic Auth

#### Postman

```
Authorization Type: Basic Auth
Username: {{username}}
Password: {{password}}
```

#### Unireq

```yaml
profiles:
  default:
    auth:
      type: basic
      username: ${username}
      password: ${secret:password}
```

### OAuth 2.0

Postman's OAuth 2.0 with "Get New Access Token" flow requires manual setup in unireq.

```yaml
profiles:
  default:
    auth:
      type: oauth2-client-credentials
      tokenUrl: https://auth.example.com/oauth/token
      clientId: ${secret:client-id}
      clientSecret: ${secret:client-secret}
      scope: "read write"
```

**Note:** unireq handles token refresh automatically.

---

## Folder Structure

Postman folders become separate collections or collection prefixes.

### Postman

```
My API Collection
├── Auth
│   ├── Login
│   └── Logout
└── Users
    ├── List Users
    └── Get User
```

### Unireq (After Import)

```yaml
collections:
  - id: auth
    name: Auth
    items:
      - id: login
        name: Login
      - id: logout
        name: Logout
  - id: users
    name: Users
    items:
      - id: list-users
        name: List Users
      - id: get-user
        name: Get User
```

**Running requests:**
```bash
> run auth/login
> run users/list-users
```

---

## Workflow Comparison

| Task | Postman | Unireq |
|------|---------|--------|
| Send request | Click Send | `get /users` or `run collection/item` |
| Switch environment | Dropdown | `profile use <name>` |
| View response | Response pane | Automatic output |
| Save request | Save to collection | `save collection/item-id` |
| Run collection | Collection Runner | `run collection/item` (per request) |
| View history | History tab | `history list` |
| Search history | History search | `history search <query>` |
| Export | Export button | `collection-export ./file.json` |

---

## Import Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Unsupported Postman version" | Collection is v2.0 | Re-export from Postman as v2.1 |
| Variables not working | Different syntax | Check `${var}` not `{{var}}` |
| Auth not working | Not imported | Configure auth in profile |
| Scripts ignored | Not supported | Use extract/assert |

### Version Check

Ensure your Postman export is v2.1:

```json
{
  "info": {
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  }
}
```

If your collection uses v2.0, re-export from Postman using "Export" → "Collection v2.1".

---

## Best Practices

### 1. Plan Your Migration

1. Export collection from Postman
2. Import into unireq
3. Set up profiles for each environment
4. Configure authentication
5. Convert critical tests to assertions

### 2. Handle Secrets Securely

```bash
# Initialize secrets vault
secret init

# Store API keys securely
secret set api-key
secret set client-secret
```

Reference in profiles:
```yaml
profiles:
  prod:
    auth:
      type: bearer
      token: ${secret:api-key}
```

### 3. Start Simple

1. Import collection (requests + variables)
2. Run requests to verify
3. Add profiles for environments
4. Add auth configuration
5. Add assertions for critical endpoints

### 4. Keep Collections Organized

```yaml
collections:
  - id: smoke
    name: Smoke Tests
    items: [...]
  - id: auth
    name: Authentication
    items: [...]
  - id: users
    name: User API
    items: [...]
```

---

## Feature Parity Reference

| Postman Feature | Unireq Support | Notes |
|-----------------|----------------|-------|
| Collections | ✅ Full | Import directly |
| Requests | ✅ Full | All HTTP methods |
| Variables | ✅ Partial | No dynamic vars |
| Environments | ✅ Alternative | Use profiles |
| Pre-request scripts | ❌ No | Use extraction |
| Test scripts | ✅ Alternative | Use assertions |
| Authentication | ✅ Partial | Manual config |
| Monitors | ❌ No | Use CI/cron |
| Mock servers | ❌ No | Use external tools |
| Documentation | ❌ No | Use OpenAPI |
| Flow/sequences | ❌ No | Run manually |
| Newman CLI | ✅ Alternative | Use unireq directly |

---

## Commands Quick Reference

```bash
# Import collection
collection-import ./postman.json

# Import with merge strategy
collection-import ./postman.json -m replace
collection-import ./postman.json -m rename

# Export back to Postman
collection-export ./export.json

# Run saved request
run collection/item

# Extract from response
extract token $.auth.token

# View variables
vars

# Switch profile
profile use prod

# Configure auth
profile set auth.type bearer
profile set auth.token ${secret:token}
```

---

## Further Reading

- [Collections Overview](../plans/COLLECTIONS-OVERVIEW.md)
- [Import/Export Specification](../plans/COLLECTIONS-IMPORT-EXPORT-SPEC.md)
- [Profiles Documentation](../plans/WORKSPACE-PROFILE-MANAGEMENT-SPEC.md)
- [Assertions Engine](../plans/COLLECTIONS-ASSERTIONS-ENGINE-SPEC.md)
- [Secrets Management](../plans/SECRETS-OVERVIEW.md)
