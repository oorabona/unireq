# @unireq/presets

[![npm version](https://img.shields.io/npm/v/@unireq/presets.svg)](https://www.npmjs.com/package/@unireq/presets)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Pre-configured clients and helpers that assemble transports + policies for common scenarios.

## Installation

```bash
pnpm add @unireq/presets
```

## Quick Start

```typescript
import { httpsJsonAuthSmart } from '@unireq/presets';

const api = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
});

const res = await api.get('/users/me');
```

## Available Presets

| Helper | Description |
| --- | --- |
| `httpsJsonAuthSmart` | HTTPS + content negotiation + retry/backoff + optional OAuth |
| `httpUploadGeneric` | Thin wrapper for upload clients |
| `createMultipartUpload` | Convenience helper over `body.multipart` with validation |
| `httpDownloadResume` | HTTP client with range/resume for partial downloads |
| `gmailImap` | Policy for Gmail INBOX over IMAP with XOAUTH2 |

## httpsJsonAuthSmart

```typescript
const api = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
  policies: [customMetrics()],
});
```

Features:
- Accepts JSON/XML
- Follows only 307/308 redirects
- Retries 408/429/5xx with `rateLimitDelay` + `backoff`
- Optional OAuth layer

## Multipart Uploads

```typescript
import { httpUploadGeneric, createMultipartUpload, body } from '@unireq/presets';

const uploader = httpUploadGeneric('https://uploads.example.com');

await uploader.post('/files', createMultipartUpload([
  { name: 'file', filename: 'doc.pdf', part: body.binary(buffer, 'application/pdf') },
]));
```

## Resume Downloads

```typescript
import { httpDownloadResume } from '@unireq/presets';

const downloader = httpDownloadResume('https://cdn.example.com', {
  resumeState: { downloaded: 5_000 },
});

const chunk = await downloader.get('/video.mp4');
```

## Preset Comparison

| Helper | OAuth | Retry | Rate-limit | Content Negotiation |
| --- | --- | --- | --- | --- |
| `httpsJsonAuthSmart` | Optional | Yes | Yes | JSON/XML |
| `httpUploadGeneric` | BYOD | No | No | Configurable |
| `httpDownloadResume` | No | No | No | Binary |
| `gmailImap` | XOAUTH2 | No | No | IMAP |

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
