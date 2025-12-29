# Server-Sent Events (SSE)

This example shows how to consume Server-Sent Events streams in real-time.

## Unireq Code

```typescript
import { client } from '@unireq/core';
import { http, parse, type SSEEvent } from '@unireq/http';

const api = client(http('https://postman-echo.com'));

// Use parse.sse() to get an AsyncIterable<SSEEvent>
const response = await api.get('/server-events/5', parse.sse());

// Async iteration over events
for await (const event of response.data) {
  console.log(`Event Type: ${event.event}`);
  console.log(`Data: ${event.data}`);
  console.log(`ID: ${event.id}`);
}
```

## Comparison with Axios

### Axios

Axios does not natively support SSE. You must use the browser's native `EventSource` API or a third-party library.

```javascript
// Browser only
const eventSource = new EventSource('https://postman-echo.com/server-events/5');

eventSource.onmessage = (event) => {
  console.log(event.data);
};

eventSource.onerror = (error) => {
  console.error('SSE failed:', error);
  eventSource.close();
};
```

### Differences

1.  **Node.js Support**: `EventSource` is not natively available in Node.js (before very recent versions or without polyfills). Unireq provides an SSE implementation that works everywhere (Node.js and Browser) with the same code.
2.  **Integration**: With Unireq, SSE is just another response format (`parse.sse()`). You benefit from the full policy chain (auth, headers, logging, etc.) for the initial connection request. With `EventSource`, it's often difficult to add custom headers (like `Authorization`).

---

<p align="center">
  <a href="#/examples/validation">← Validation</a> · <a href="#/README">Home →</a>
</p>
