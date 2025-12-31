---
doc-meta:
  status: draft
  scope: output
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Output Documentation Index

## Overview

Output formatting and UX: pretty printing, raw output, request/response tracing, curl export.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/OUTPUT-OVERVIEW.md) | design | draft | Scope overview and features |

## Output Options

| Option | Description |
|--------|-------------|
| `--raw` | Strict raw output (for piping) |
| `--json` | Force JSON output |
| `--jq <expr>` | JQ expression filter (optional) |
| `--curl` | Show equivalent curl command |
| `--trace` | Show request/response details (headers, timings) |

## Output Formats

| Format | Description |
|--------|-------------|
| `pretty` | Colored, formatted output (default) |
| `raw` | Unformatted, no colors |
| `json` | JSON structure |

## Configuration

```yaml
defaults:
  output:
    format: pretty   # pretty|raw|json
    color: auto      # auto|on|off
    pager: auto      # Use pager for long output
```

## Trace Output Example

```
→ GET https://api.example.com/users/42
  Authorization: Bearer ****
  Accept: application/json

← 200 OK (142ms)
  Content-Type: application/json; charset=utf-8
  X-Request-Id: abc-123

{
  "id": 42,
  "name": "John Doe"
}
```

## Features

- Pretty print JSON / YAML / text
- Syntax highlighting (colors)
- Pager support for long output
- Secret redaction in trace mode
- Timing information

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_OUTPUT.md](../../TODO_OUTPUT.md)
