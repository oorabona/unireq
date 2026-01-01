# @unireq/cli

[![npm version](https://img.shields.io/npm/v/@unireq/cli.svg)](https://www.npmjs.com/package/@unireq/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

HTTP CLI client with REPL mode for API exploration and testing. Like `curl` meets `kubectl` with OpenAPI awareness.

## Installation

```bash
pnpm add -g @unireq/cli
# or
npm install -g @unireq/cli
```

## Quick Start

### One-Shot Mode

Execute HTTP requests directly from the command line:

```bash
# Simple GET request
unireq get https://api.example.com/users

# POST with JSON body
unireq post https://api.example.com/users -d '{"name":"Alice","email":"alice@example.com"}'

# With headers and query parameters
unireq get https://api.example.com/users -H "Authorization: Bearer token" -q "page=1" -q "limit=10"

# Trace mode (timing details)
unireq get https://api.example.com/users --trace

# Export as curl command
unireq get https://api.example.com/users --export curl
```

### REPL Mode

Launch interactive mode for API exploration:

```bash
unireq
```

Navigate and explore APIs like a filesystem:

```
unireq> cd /users
/users> ls
GET     /users          List all users
POST    /users          Create a new user
GET     /users/{id}     Get user by ID

/users> get
[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]

/users> post -d '{"name":"Charlie"}'
{"id":3,"name":"Charlie"}

/users> cd ..
/> exit
```

## Features

| Feature | Description |
|---------|-------------|
| One-shot mode | Execute single requests like curl/httpie |
| REPL mode | Interactive API exploration with navigation |
| OpenAPI integration | Load specs for autocompletion and validation |
| Workspaces | Project-based configuration with profiles |
| Authentication | API key, Bearer, JWT login, OAuth2 client credentials |
| Collections | Save and replay requests with assertions |
| Secrets vault | Secure credential storage with OS keychain support |
| Output formats | Pretty, JSON, raw, with syntax highlighting |
| Export | Generate curl/httpie equivalent commands |

## Commands

### HTTP Methods

All standard HTTP methods are supported:

```bash
unireq get <url>
unireq post <url> [-d <body>]
unireq put <url> [-d <body>]
unireq patch <url> [-d <body>]
unireq delete <url>
unireq head <url>
unireq options <url>
```

### Request Options

| Option | Description |
|--------|-------------|
| `-H, --header <header>` | Add header (repeatable): `-H "Content-Type: application/json"` |
| `-q, --query <param>` | Add query parameter (repeatable): `-q "page=1"` |
| `-d, --data <body>` | Request body (JSON auto-detected) |
| `-o, --output <format>` | Output format: `pretty`, `json`, `raw` |
| `--trace` | Show timing details (TTFB, download, total) |
| `--export <format>` | Export as: `curl`, `httpie` |

### Workspace Commands

```bash
# Initialize a workspace in current directory
unireq workspace init

# List all workspaces
unireq workspace list

# Add a workspace to registry
unireq workspace add my-api /path/to/project

# Switch active workspace
unireq workspace use my-api

# Remove workspace from registry
unireq workspace remove my-api

# Validate workspace configuration
unireq workspace doctor
```

### Profile Commands (REPL)

```
profile list              # List available profiles
profile use <name>        # Switch to profile
profile show              # Show current profile details
```

### Auth Commands (REPL)

```
auth login               # Authenticate with configured provider
auth status              # Show current auth state
auth logout              # Clear authentication
```

### Collection Commands (REPL)

```
save <name>              # Save last request to collection
run <name>               # Execute saved request
history                  # Show request history
```

### Secret Commands (REPL)

```
secret set <name>        # Store a secret
secret get <name>        # Retrieve a secret
secret list              # List secret names
secret delete <name>     # Remove a secret
```

## Workspace Configuration

Create a `.unireq/workspace.yaml` in your project:

```yaml
version: 1
name: my-api
baseUrl: https://api.example.com

# Variables for interpolation
vars:
  apiVersion: v1

# Environment profiles
profiles:
  dev:
    baseUrl: http://localhost:3000
    vars:
      debug: true
  prod:
    baseUrl: https://api.example.com
    vars:
      debug: false

activeProfile: dev

# OpenAPI spec for navigation and validation
openapi:
  source: ./openapi.yaml

# Authentication configuration
auth:
  default: bearer
  providers:
    bearer:
      type: bearer
      token: ${secret:api_token}

# Secrets backend
secrets:
  backend: auto  # auto | keychain | vault
```

### Variable Interpolation

Use variables in your configuration:

```yaml
baseUrl: https://${var:host}:${env:PORT}
headers:
  Authorization: Bearer ${secret:api_token}
  X-Request-ID: ${prompt:request_id}
```

| Syntax | Source |
|--------|--------|
| `${var:name}` | Workspace variables |
| `${env:NAME}` | Environment variables |
| `${secret:name}` | Secure vault storage |
| `${prompt:name}` | Interactive prompt |

## Output Formats

### Pretty (default)

Syntax-highlighted JSON/XML with colored status codes:

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "name": "Alice"
}
```

### JSON

Raw JSON output for piping:

```bash
unireq get /users -o json | jq '.[] | .name'
```

### Trace

Detailed timing information:

```
TTFB:     45ms  ████████░░░░░░░░
Download: 12ms  ███░░░░░░░░░░░░░
Total:    57ms
```

## Dependencies

- `@unireq/http` - HTTP client core
- `@unireq/core` - Request composition
- `@unireq/config` - Configuration management

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
