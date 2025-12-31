---
doc-meta:
  status: draft
  scope: output
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# Output Overview

## Purpose

Output formatting and display providing:
- Multiple output formats (pretty, JSON, raw)
- Syntax-highlighted responses
- Trace/debug mode with timing
- Export capabilities

## Key Features

### Output Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| Pretty | Colored, formatted output | Interactive use |
| JSON | Machine-readable JSON | Scripting, piping |
| Raw | Unformatted response body | Binary data, redirects |

### Pretty Mode Features

| Feature | Description |
|---------|-------------|
| Syntax highlighting | JSON, XML, HTML colorization |
| Status coloring | Green (2xx), Yellow (3xx), Red (4xx/5xx) |
| Header formatting | Key-value alignment |
| Body truncation | Large responses with `--max-body` |

### Trace Mode

```
unireq --trace get /users

▸ DNS lookup: api.example.com → 93.184.216.34 (12ms)
▸ TCP connect: 93.184.216.34:443 (8ms)
▸ TLS handshake: TLS 1.3 (45ms)
▸ Request sent: GET /users (2ms)
▸ First byte: (89ms)
▸ Body received: 1.2 KB (23ms)
────────────────────────────────────
Total: 179ms
```

## Target Users

- Developers debugging API calls
- DevOps scripting with jq/grep
- QA validating response formats

## Configuration

```yaml
output:
  format: pretty       # pretty|json|raw
  color: auto          # auto|always|never
  maxBodyBytes: 102400 # 100KB default truncation
  trace: false
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--json` | Force JSON output |
| `--raw` | Force raw output |
| `--no-color` | Disable colors |
| `--trace` | Enable timing trace |
| `--headers-only` | Only show headers |
| `-o <file>` | Write body to file |

## REPL Display

### Response Summary

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: abc123

{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ]
}

── 200 OK · 1.2 KB · 89ms ──
```

### Error Display

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer

{
  "error": "invalid_token",
  "message": "Token has expired"
}

── 401 Unauthorized · 78 bytes · 45ms ──
```

## Export Formats

| Format | Description |
|--------|-------------|
| `json` | Full response as JSON |
| `curl` | Equivalent curl command |
| `httpie` | Equivalent HTTPie command |
| `har` | HTTP Archive format |

## Security: Auto-Redaction

Sensitive headers automatically masked in `--trace`:

| Header | Display |
|--------|---------|
| `Authorization` | `Bearer ****` |
| `X-API-Key` | `****` |
| `Cookie` | `session=****` |

## Syntax Highlighting

| Content-Type | Highlighter |
|--------------|-------------|
| `application/json` | JSON syntax |
| `application/xml` | XML syntax |
| `text/html` | HTML syntax |
| `text/plain` | Plain text |

## Open Questions

- [ ] Syntax highlighter library (chalk + custom vs cli-highlight)
- [ ] HAR export completeness
- [ ] Binary content detection heuristics

## Next Steps

1. Run `/clarify output` to detail requirements
2. Run `/spec output-formatting` for format implementation
3. Run `/spec output-trace` for trace mode
