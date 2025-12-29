# @unireq/presets

Pre-configured clients and helpers that assemble transports + policies for common scenarios.

## Installation

```bash
pnpm add @unireq/presets
```

## Export overview

| Helper | Description |
| --- | --- |
| `httpsJsonAuthSmart(uri, options)` | HTTPS client with content negotiation, redirect hardening, HTTP-aware retry/backoff, optional OAuth. |
| `httpUploadGeneric(uri?, options?)` | Thin wrapper that returns `client(http(uri), ...policies)` for uploads. |
| `createMultipartUpload(files, fields?, options?)` | Convenience helper over `body.multipart` (validation included). |
| `httpDownloadResume(uri, resumeStateOrOptions?)` | HTTP client pre-wired with `range/resume` for partial downloads. |
| `gmailImap(tokenSupplier)` | Policy that selects `INBOX` over IMAP with XOAUTH2.
| `resume`, `multipart`, `MultipartFile`, ... | Re-exports from `@unireq/http` for consumers who only import presets.

## httpsJsonAuthSmart

```ts
import { httpsJsonAuthSmart } from '@unireq/presets';

const api = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
  allowUnsafeMode: false,
  policies: [customMetrics()],
});

const res = await api.get('/users/me');
```

- Accepts JSON/XML, follows only `307/308`, retries (408/429/5xx) with `rateLimitDelay` + `backoff` strategies.
- Optional `oauthBearer` layer (only if `tokenSupplier` provided). Ordering matches the guidance from [composition](../concepts/composition.md).
- You may append extra policies via `options.policies` (they run closest to the transport).

## httpUploadGeneric + createMultipartUpload

```ts
import { httpUploadGeneric, createMultipartUpload } from '@unireq/presets';

const uploader = httpUploadGeneric('https://uploads.example.com');

await uploader.post('/files', createMultipartUpload([
  { name: 'file', filename: 'doc.pdf', part: body.binary(fileBuffer, 'application/pdf') },
]));
```

- `httpUploadGeneric` just returns a `client` so you can compose your own policies (auth, logging, etc.).
- `createMultipartUpload` enforces size/type limits via `MultipartValidationOptions` before serializing the body.

## httpDownloadResume

```ts
import { httpDownloadResume } from '@unireq/presets';

const downloader = httpDownloadResume('https://cdn.example.com', { resumeState: { downloaded: 5_000 } });
const chunk = await downloader.get('/video.mp4');
```

- Detects whether the server supports `Accept-Ranges` and, if so, resumes from `resumeState.downloaded` via the `range` policy.
- Pass `options.policies` to add logging or checksum verification.

## gmailImap

```ts
import { gmailImap } from '@unireq/presets';
import { client } from '@unireq/core';
import { imap } from '@unireq/imap';

const gmail = client(imap({ host: 'imap.gmail.com', port: 993 }), gmailImap(() => getGmailToken()));
const inbox = await gmail.list();
```

- Wraps the XOAUTH2 policy from `@unireq/imap` and issues a `SELECT INBOX` command automatically.
- Replace `gmailImap` with your own policy if you need a different mailbox or capability negotiation.

## Choosing a preset

| Helper | Transport | OAuth | Retry/backoff | Rate-limit aware | Content negotiation |
| --- | --- | --- | --- | --- | --- |
| `httpsJsonAuthSmart` | HTTP/HTTPS | Optional | ✅ | ✅ (`Retry-After`) | JSON ↔ XML via `either()` |
| `httpUploadGeneric` | HTTP/HTTPS | Bring-your-own | ❌ | ❌ | Depends on added policies |
| `httpDownloadResume` | HTTP/HTTPS | N/A | ❌ | ❌ | Binary chunks |
| `gmailImap` | IMAP (`imapflow`) | ✅ (XOAUTH2) | ❌ | ❌ | IMAP responses |

Need a different combo? These helpers are short wrappers around `client(http(...), ...policies)`, so inspect [packages/presets/src](../packages/presets/src) and copy the pattern into your app.

---

<p align="center">
  <a href="#/packages/ftp">← FTP</a> · <a href="#/packages/config">Config →</a>
</p>