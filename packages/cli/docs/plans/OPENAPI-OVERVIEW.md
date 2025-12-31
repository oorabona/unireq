---
doc-meta:
  status: draft
  scope: openapi
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# OpenAPI Overview

## Purpose

OpenAPI integration providing:
- Spec import from file or URL
- Path and operation indexation
- REPL autocompletion
- Endpoint discovery and describe
- Input/output validation

## Key Features

### When OpenAPI is Present

| Feature | Description |
|---------|-------------|
| Import | Load from local file or remote URL |
| Indexation | Build searchable index of paths + methods |
| Autocompletion | Tab completion in REPL |
| Discovery | `ls` shows available endpoints |
| Describe | `describe` shows params, body, schemas |
| Validation | Light validation (types, required) |

### Fallback Without OpenAPI

| Feature | Description |
|---------|-------------|
| Collections | Navigate via saved requests |
| Heuristics | Infer structure from usage |
| Record mode (V2) | Learn from executed requests |

## Target Users

- Developers exploring new APIs
- QA validating against spec
- Teams with OpenAPI-first workflows

## Configuration

```yaml
openapi:
  source: https://api.example.com/openapi.json
  # or: source: ./openapi.yaml
  cache:
    enabled: true
    ttlMs: 86400000  # 24 hours
```

## Navigation Model

OpenAPI paths are presented as a filesystem:

```
/                           # Root
├── users/                  # Resource group
│   ├── GET                 # List users
│   ├── POST                # Create user
│   └── {id}/               # User by ID
│       ├── GET             # Get user
│       ├── PUT             # Update user
│       └── DELETE          # Delete user
└── health/
    └── GET                 # Health check
```

## REPL Integration

```
unireq> cd /users
/users> ls
GET     List all users
POST    Create a new user
{id}/   User operations by ID

/users> describe POST
POST /users
  Summary: Create a new user
  Body (required):
    - name: string (required)
    - email: string (required, format: email)
  Responses:
    201: User created
    400: Validation error
```

## Validation Levels

| Level | Description |
|-------|-------------|
| Off | No validation |
| Soft (default) | Warn on issues, proceed |
| Strict | Error on issues, abort |

## Supported Spec Versions

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0 (with conversion)

## Open Questions

- [ ] JSONPath-lite exact syntax for extraction
- [ ] Validation strictness default
- [ ] Handling of $ref resolution

## Next Steps

1. Run `/clarify openapi` to detail requirements
2. Run `/spec openapi-import` for import flow
3. Run `/spec openapi-navigation` for tree building
