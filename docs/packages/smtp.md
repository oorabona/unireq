# @unireq/smtp

SMTP transport with a pluggable connector architecture. Ships with a default connector powered by [`nodemailer`](https://nodemailer.com/), but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/smtp

# For the default connector (optional peer dependency)
pnpm add nodemailer
```

## Export Overview

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `smtp(uri?, connector?)` | Creates a `TransportWithCapabilities` that knows how to send emails. |
| Connector interface | `SMTPConnector`, `SMTPSession`, `SMTPCapabilities` | Types for implementing custom connectors. |
| Default connector | `NodemailerConnector` | Default implementation using `nodemailer` library. |
| Types | `EmailMessage`, `EmailAttachment`, `SendResult` | Email composition structures. |

## Quick Start

```typescript
import { client } from '@unireq/core';
import { smtp } from '@unireq/smtp';

// Create transport (uses NodemailerConnector by default)
const { transport, capabilities } = smtp('smtp://user:pass@smtp.gmail.com:587');

// Create client
const mail = client(transport);

// Send an email
const result = await mail.post<SendResult>('/', {
  from: 'me@gmail.com',
  to: 'you@example.com',
  subject: 'Hello!',
  text: 'This is a test email.',
});
```

## Transport Factory

```typescript
import { smtp, NodemailerConnector } from '@unireq/smtp';

// Option 1: Default connector (requires nodemailer)
const { transport } = smtp('smtp://user:pass@smtp.gmail.com:587');

// Option 2: SMTPS (implicit TLS on port 465)
const { transport } = smtp('smtps://user:pass@smtp.gmail.com:465');

// Option 3: With OAuth2
const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
  oauth2: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  },
});

// Option 4: Bring Your Own Connector (BYOC)
const { transport } = smtp('smtp://smtp.example.com', myCustomConnector);
```

- Use `smtp://` for STARTTLS (port 587) and `smtps://` for implicit TLS (port 465)
- Credentials can be embedded in the URL
- The `capabilities` object indicates supported features

## Email Message Format

```typescript
import type { EmailMessage, EmailAttachment } from '@unireq/smtp';

const message: EmailMessage = {
  // Required fields
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email Subject',

  // Body (text, html, or both)
  text: 'Plain text body',
  html: '<h1>HTML body</h1>',

  // Optional fields
  cc: 'cc@example.com',
  bcc: ['bcc1@example.com', 'bcc2@example.com'],
  replyTo: 'reply@example.com',
  priority: 'high', // 'high' | 'normal' | 'low'
  headers: { 'X-Custom-Header': 'value' },

  // Attachments
  attachments: [
    {
      filename: 'document.pdf',
      content: bufferOrString,
      contentType: 'application/pdf',
    },
    {
      filename: 'inline-image.png',
      content: imageBuffer,
      contentType: 'image/png',
      cid: 'image1', // For inline embedding: <img src="cid:image1">
      disposition: 'inline',
    },
  ],
};
```

### Named Addresses

```typescript
const message: EmailMessage = {
  from: { name: 'Sender Name', address: 'sender@example.com' },
  to: [
    { name: 'Recipient 1', address: 'r1@example.com' },
    { name: 'Recipient 2', address: 'r2@example.com' },
  ],
  subject: 'Hello!',
  text: 'Message body',
};
```

## Send Result

```typescript
interface SendResult {
  /** Recipients that accepted the email */
  accepted: string[];

  /** Recipients that rejected the email */
  rejected: string[];

  /** Unique message identifier */
  messageId: string;

  /** SMTP server response */
  response: string;
}
```

## Gmail Authentication

Gmail requires special authentication setup. Choose one of these methods:

### Option 1: App Password (Recommended for Development)

1. Enable 2-Step Verification on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create an App Password for "Mail"
4. Use the 16-character password in your URI

```typescript
const { transport } = smtp('smtp://your@gmail.com:xxxx-xxxx-xxxx-xxxx@smtp.gmail.com:587');
```

**Security Note**: App Passwords grant full mail access. Use only in secure environments.

### Option 2: OAuth2 (Recommended for Production)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API
3. Create OAuth2 credentials (Desktop app type for CLI apps)
4. Obtain refresh token using the OAuth flow

```typescript
const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
  oauth2: {
    clientId: 'your-client-id.apps.googleusercontent.com',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  },
});
```

### Gmail Server Configuration

| Protocol | Host | Port | Security |
| --- | --- | --- | --- |
| IMAP | imap.gmail.com | 993 | SSL/TLS |
| SMTP | smtp.gmail.com | 587 | STARTTLS |
| SMTP | smtp.gmail.com | 465 | SSL/TLS |

## Ergonomic Facade with Presets

For a higher-level API, use the facade from `@unireq/presets`:

```typescript
import { preset } from '@unireq/presets';

const mail = preset.smtp
  .uri('smtp://user:app-password@smtp.gmail.com:587')
  .retry
  .build();

// Simple methods
await mail.send({
  from: 'me@gmail.com',
  to: 'you@example.com',
  subject: 'Hello!',
  text: 'Message body',
});

// Shorthand for text emails
await mail.sendText('recipient@example.com', 'Subject', 'Body text');

// Shorthand for HTML emails
await mail.sendHtml('recipient@example.com', 'Subject', '<h1>Hello</h1>', 'Fallback text');

// Access raw client for advanced operations
const raw = mail.raw;
```

### Facade with OAuth2

```typescript
const mail = preset.smtp
  .uri('smtp://user@gmail.com@smtp.gmail.com:587')
  .oauth2({
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  })
  .retry
  .build();
```

### Setting Default "From" Address

```typescript
const mail = preset.smtp
  .uri('smtp://smtp.gmail.com:587')
  .from('noreply@company.com')
  .retry
  .build();

// No need to specify "from" in every email
await mail.sendText('recipient@example.com', 'Subject', 'Body');
```

## Bring Your Own Connector (BYOC)

When the default `nodemailer` connector doesn't meet your needs, implement `SMTPConnector`:

```typescript
import type { SMTPConnector, SMTPSession, SMTPCapabilities } from '@unireq/smtp';
import type { RequestContext, Response } from '@unireq/core';

class MySMTPConnector implements SMTPConnector {
  readonly capabilities: SMTPCapabilities = {
    smtp: true,
    smtps: true,
    starttls: true,
    oauth2: false,
    html: true,
    attachments: true,
  };

  async connect(uri: string): Promise<SMTPSession> {
    const url = new URL(uri);
    await mySmtpLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 587,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'smtps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      secure: url.protocol === 'smtps:',
    };
  }

  async request(session: SMTPSession, context: RequestContext): Promise<Response> {
    const message = context.body as EmailMessage;

    try {
      const result = await mySmtpLibrary.send(message);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {
          accepted: result.accepted,
          rejected: result.rejected,
          messageId: result.messageId,
          response: result.response,
        },
        ok: true,
      };
    } catch (error) {
      return {
        status: 500,
        statusText: 'Error',
        headers: {},
        data: { error: error.message },
        ok: false,
      };
    }
  }

  disconnect(session: SMTPSession): void {
    mySmtpLibrary.close();
  }
}

// Use your connector
const { transport } = smtp('smtp://server.com', new MySMTPConnector());
```

### SMTPConnector Interface

```typescript
interface SMTPConnector {
  /** Supported capabilities */
  readonly capabilities: SMTPCapabilities;

  /** Establish connection and return session */
  connect(uri: string): Promise<SMTPSession>;

  /** Send email */
  request(session: SMTPSession, context: RequestContext): Promise<Response>;

  /** Verify connection (optional) */
  verify?(session: SMTPSession): Promise<boolean>;

  /** Clean up resources */
  disconnect(session: SMTPSession): Promise<void> | void;
}

interface SMTPSession {
  connected: boolean;
  host: string;
  user: string;
  secure: boolean;
}

interface SMTPCapabilities {
  readonly smtp: boolean;
  readonly smtps: boolean;
  readonly starttls: boolean;
  readonly oauth2: boolean;
  readonly html: boolean;
  readonly attachments: boolean;
}
```

### Why BYOC?

- **Testing**: Use mock connectors for unit tests without real SMTP servers
- **Enterprise**: Integrate with internal mail libraries that handle auth/logging
- **Transactional Email Services**: Create connectors for SendGrid, Mailgun, etc.
- **Tree-shaking**: Avoid bundling `nodemailer` if you use a custom connector

## Connection Lifecycle

- The transport lazily connects on the first send and reuses the session
- Connections are pooled when using `pool: true` option
- Use `connector.disconnect()` in shutdown hooks

## Error Handling & Retries

```typescript
import { client, retry, backoff } from '@unireq/core';
import { smtp } from '@unireq/smtp';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientMail = client(
  smtp('smtp://smtp.gmail.com:587').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Network/auth errors return `{ ok: false, status: 500, data: { error: message } }`
- Compose with `retry`, circuit breakers, or `either` from `@unireq/core`
- Be mindful of rate limits from email providers

## Complete Gmail Example

```typescript
import { preset } from '@unireq/presets';

// Using App Password
const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;

// Create SMTP client
const mail = preset.smtp
  .uri(`smtp://${encodeURIComponent(GMAIL_USER)}:${encodeURIComponent(GMAIL_APP_PASSWORD)}@smtp.gmail.com:587`)
  .retry
  .build();

// Create IMAP client for reading
const inbox = preset.imap
  .uri(`imaps://${encodeURIComponent(GMAIL_USER)}:${encodeURIComponent(GMAIL_APP_PASSWORD)}@imap.gmail.com:993`)
  .retry
  .build();

// Read last 10 emails
const messages = await inbox.fetch('INBOX', '1:10');
console.log(`Found ${messages.length} emails`);

// Send an email
const result = await mail.send({
  from: GMAIL_USER,
  to: 'recipient@example.com',
  subject: 'Hello from unireq!',
  text: 'This email was sent using @unireq/smtp',
  html: '<h1>Hello from unireq!</h1><p>This email was sent using @unireq/smtp</p>',
});

console.log(`Sent: ${result.messageId}`);
```

---

<p align="center">
  <a href="#/packages/imap">&larr; IMAP</a> &middot; <a href="#/packages/xml">XML &rarr;</a>
</p>
