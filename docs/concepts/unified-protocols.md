# Why unireq for All Protocols

You might wonder: does unireq really make sense for connection-based protocols like IMAP, SMTP, and FTP? After all, HTTP is stateless and "fire-and-forget", while these protocols maintain persistent sessions.

**Short answer**: Yes, and here's why.

## The HTTP Metaphor Doesn't Fit Perfectly

Let's be honest. The HTTP-style API feels natural for HTTP:

```typescript
// HTTP - makes perfect sense
await client.get('/users/123');
await client.post('/orders', { items: [...] });
```

But for IMAP, it's more awkward:

```typescript
// IMAP - the abstraction shows
await client.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
```

The verbs (GET/POST) and URLs don't map naturally to IMAP commands. That's why we provide **protocol-specific facades**:

```typescript
// With facade - natural API
const inbox = preset.imap.uri('imap://...').retry.build();
await inbox.fetch('INBOX', '1:10');
await inbox.search('INBOX', { seen: false });
```

## What unireq Actually Brings

### 1. Cross-Cutting Policies — The Real Win

These concerns are **identical** regardless of protocol:

```typescript
const resilientMail = client(
  imap('imap://...').transport,
  retry(predicate, [backoff({ initial: 1000 })], { tries: 3 }),
  timeout(30000),
  logging({ level: 'debug' }),
  circuitBreaker({ threshold: 5 }),
);
```

Whether you're sending an email or fetching a REST API:
- **Retry** on network failures
- **Timeout** if it takes too long
- **Log** what's happening
- **Circuit break** if the server is down

Before unireq, each library reimplemented these:
- `nodemailer` has its own retry
- `imapflow` has its own timeout
- `basic-ftp` has its own error handling

With unireq, you compose once.

### 2. BYOC (Bring Your Own Connector) — Testing & Flexibility

```typescript
// Test without a real SMTP server
const mockConnector: SMTPConnector = {
  capabilities: { smtp: true, smtps: true, /* ... */ },
  connect: vi.fn().mockResolvedValue({ connected: true, host: 'mock' }),
  request: vi.fn().mockResolvedValue({
    ok: true,
    data: { messageId: '<test@mock>', accepted: ['user@example.com'] }
  }),
  disconnect: vi.fn(),
};

const mail = preset.smtp
  .uri('smtp://fake')
  .connector(mockConnector)
  .build();

await mail.send({ to: 'test@example.com', subject: 'Test' });
expect(mockConnector.request).toHaveBeenCalled();
```

This is **huge** for testing:
- Test your code without real Gmail/IMAP servers
- Simulate network errors
- Verify retry behavior
- Replace `nodemailer` with `sendgrid` without changing your code

### 3. Ecosystem Uniformity

```typescript
// Same pattern, same mental model
const http = preset.http.uri('https://api.com').retry.build();
const mail = preset.smtp.uri('smtp://gmail.com').retry.build();
const inbox = preset.imap.uri('imap://gmail.com').retry.build();
const files = preset.ftp.uri('ftp://server.com').retry.build();

// Same error handling everywhere
const result = await mail.send(...);
if (!result.ok) { /* handle error */ }
```

**One pattern to learn** = faster onboarding for your team.

## Connection Lifecycle for Stateful Protocols

Unlike HTTP, IMAP/SMTP/FTP maintain persistent connections. Here's how unireq handles them:

### Lazy Connection

The connection is established on the **first request**, not when you create the client:

```typescript
const inbox = preset.imap.uri('imap://...').build();
// No connection yet

const messages = await inbox.fetch('INBOX', '1:10');
// Connection established here, then reused
```

### Session Reuse

All subsequent commands use the **same session**:

```typescript
await inbox.fetch('INBOX', '1:10');    // Uses session
await inbox.search('INBOX', { ... });  // Reuses same session
await inbox.move('INBOX', 'Archive', [1, 2, 3]); // Still same session
```

This is more efficient than reconnecting for each operation.

### Graceful Shutdown

For long-running applications, disconnect in your shutdown hooks:

```typescript
// Access the underlying connector if needed
process.on('SIGTERM', async () => {
  // The facade doesn't expose disconnect directly,
  // but the transport handles cleanup when the process exits
  console.log('Shutting down...');
  process.exit(0);
});
```

### Automatic Reconnection

If the connection drops (network hiccup), the transport attempts reconnection on the next request. Combined with `retry` policies, your application stays resilient:

```typescript
const inbox = preset.imap
  .uri('imap://...')
  .retry  // Retries include reconnection attempts
  .build();
```

## The Architecture That Makes It Possible

```
┌─────────────────────────────────────────────────────┐
│                   Your Code                         │
│         inbox.fetch('INBOX', '1:10')               │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Protocol Facade                        │
│    ImapFacade / SmtpFacade / FtpFacade             │
│    (Natural, domain-specific API)                   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                 Policies                            │
│    retry() + backoff() + timeout() + logging()     │
│    (Composable, protocol-agnostic)                 │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                Transport                            │
│         (ctx) => Promise<Response>                  │
│    (Manages connection, translates to protocol)    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                Connector (BYOC)                     │
│    ImapFlowConnector / NodemailerConnector / ...   │
│    (Actual protocol implementation)                 │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
                   [ Network ]
```

1. **Transport** = function `(ctx) => Promise<Response>`
2. **Connector interface** = `connect()` / `request()` / `disconnect()`
3. **Policies** = composable middleware
4. **Facades** = domain-specific API on top

## Summary

| Benefit | Impact |
|---------|--------|
| Reusable policies (retry, timeout, logging) | ⭐⭐⭐⭐⭐ |
| BYOC for testing | ⭐⭐⭐⭐⭐ |
| Unified API (one pattern to learn) | ⭐⭐⭐⭐ |
| Composability (IMAP + SMTP in same flow) | ⭐⭐⭐⭐ |
| Connection management abstracted | ⭐⭐⭐ |

The HTTP metaphor is slightly forced for connection-based protocols, but the benefits—reusable policies, testability via BYOC, and ecosystem consistency—justify the approach. The protocol-specific facades provide a natural DX while leveraging the composable power underneath.

---

<p align="center">
  <a href="#/concepts/composition">&larr; Composition</a> &middot; <a href="#/concepts/body-parsing">Body & Parsing &rarr;</a>
</p>
