---
doc-meta:
  status: draft
  scope: collections
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# Collections Overview

## Purpose

Request collections and scenarios providing:
- Saved requests ("recipes") for replay
- Variable extraction from responses
- Simple assertions for validation
- Command history management

## Key Features

### V1 Features

| Feature | Description |
|---------|-------------|
| Save request | Store request as reusable template |
| Variables | `${var}` interpolation |
| Extraction | JSONPath-lite from response |
| Assertions | status, header, contains, equals |
| History | NDJSON command/request log |

### V2 Features

| Feature | Description |
|---------|-------------|
| Scenarios | Multi-step pipelines with dependencies |
| Replay | Capture and replay sequences |
| Proxy mode | Intercept and record requests |
| Exports | markdown, junit, json reports |

## Target Users

- QA running E2E test scenarios
- Developers sharing API recipes
- DevOps scripting smoke tests

## Commands

```
unireq history [--tail <n>] [--json]
unireq save <name>
unireq run <name> [--var <k=v>...]
```

## Collection Schema

```yaml
collections:
  - name: smoke
    description: Basic health checks
    items:
      - name: health
        description: API health endpoint
        request:
          method: GET
          path: /health
          assert:
            status: 200

      - name: auth-flow
        request:
          method: POST
          path: /auth/login
          body:
            username: "${var:testUser}"
            password: "${secret:testPassword}"
        extract:
          vars:
            token: "$.token"
        assert:
          status: 200
          json:
            - path: "$.token"
              op: exists
```

## Assertion Types

| Type | Example |
|------|---------|
| Status | `status: 200` |
| Header | `header: { Content-Type: "application/json" }` |
| JSON path | `json: [{ path: "$.id", op: exists }]` |

## JSON Assertion Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `contains` | Substring/subset match |
| `matches` | Regex match |
| `exists` | Path exists (non-null) |

## History Format (NDJSON)

```json
{"ts":"2025-12-29T01:23:45.123Z","kind":"cmd","text":"get /health","cwd":"/","workspace":"my-api"}
{"ts":"2025-12-29T01:23:45.456Z","kind":"http","method":"GET","url":"https://api.example.com/health","status":200,"durationMs":112,"bytesIn":345,"bytesOut":0,"savedAs":null}
```

## Open Questions

- [ ] JSONPath-lite exact syntax
- [ ] Assertion failure behavior (continue vs abort)
- [ ] Collection sharing/import format

## Next Steps

1. Run `/clarify collections` to detail requirements
2. Run `/spec collections-schema` for YAML schema
3. Run `/spec collections-assertions` for assertion engine
