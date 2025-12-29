# @unireq/smtp

[![npm version](https://img.shields.io/npm/v/@unireq/smtp.svg)](https://www.npmjs.com/package/@unireq/smtp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SMTP transport with a pluggable connector architecture. Ships with a default connector powered by `nodemailer`, but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/smtp

# For the default connector (optional peer dependency)
pnpm add nodemailer
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { smtp } from '@unireq/smtp';

const { transport } = smtp('smtp://user:pass@smtp.gmail.com:587');
const mail = client(transport);

const result = await mail.post('/', {
  from: 'me@gmail.com',
  to: 'you@example.com',
  subject: 'Hello!',
  text: 'This is a test email.',
});
```

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `smtp(uri?, connector?)` | SMTP/SMTPS transport factory |
| Default connector | `NodemailerConnector` | Implementation using `nodemailer` |
| Types | `EmailMessage`, `EmailAttachment`, `SendResult` | Email composition structures |

## Email Message Format

```typescript
const message = {
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email Subject',
  text: 'Plain text body',
  html: '<h1>HTML body</h1>',
  cc: 'cc@example.com',
  bcc: ['bcc1@example.com'],
  attachments: [
    { filename: 'doc.pdf', content: buffer, contentType: 'application/pdf' },
  ],
};
```

## Gmail Authentication

### App Password (Development)

```typescript
const { transport } = smtp('smtp://your@gmail.com:xxxx-xxxx-xxxx-xxxx@smtp.gmail.com:587');
```

### OAuth2 (Production)

```typescript
const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
  oauth2: {
    clientId: 'your-client-id.apps.googleusercontent.com',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  },
});
```

## Bring Your Own Connector

```typescript
import type { SMTPConnector, SMTPSession } from '@unireq/smtp';

class MySMTPConnector implements SMTPConnector {
  readonly capabilities = { smtp: true, smtps: true, starttls: true, oauth2: false, html: true, attachments: true };

  async connect(uri: string): Promise<SMTPSession> { /* ... */ }
  async request(session, context) { /* ... */ }
  disconnect(session) { /* ... */ }
}

const { transport } = smtp('smtp://server.com', new MySMTPConnector());
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
