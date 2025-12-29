import { createServer } from 'node:http';

/**
 * Mock HTTP server standalone pour tester les exemples
 * Démarre un vrai serveur HTTP qui simule les endpoints httpbin.org
 */

const PORT = 3001;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}${url.search}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /post - Multipart & form handler
    if (req.method === 'POST' && url.pathname === '/post') {
      const contentType = req.headers['content-type'] || '';
      const chunks: Buffer[] = [];

      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }

      const body = Buffer.concat(chunks);

      // Parse multipart (simple extraction)
      if (contentType.startsWith('multipart/form-data')) {
        const files: Record<string, { filename: string; size: number; type: string }> = {};
        const form: Record<string, string> = {};

        // Simuler parsing (simplifié pour l'exemple)
        const bodyStr = body.toString();
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);

        if (boundaryMatch) {
          const boundary = boundaryMatch[1];
          const parts = bodyStr.split(`--${boundary}`);

          for (const part of parts) {
            if (part.includes('Content-Disposition')) {
              const nameMatch = part.match(/name="([^"]+)"/);
              const filenameMatch = part.match(/filename="([^"]+)"/);

              if (nameMatch) {
                const name = nameMatch[1];
                if (filenameMatch) {
                  files[name] = {
                    filename: filenameMatch[1],
                    size: 100,
                    type: 'application/octet-stream',
                  };
                } else {
                  const contentMatch = part.split('\r\n\r\n')[1];
                  if (contentMatch) {
                    form[name] = contentMatch.split('\r\n')[0];
                  }
                }
              }
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files, form }));
        return;
      }

      // Parse form urlencoded
      if (contentType === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams(body.toString());
        const form: Record<string, string> = {};
        for (const [key, value] of params.entries()) {
          form[key] = value;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            form,
            headers: { 'Content-Type': contentType },
          }),
        );
        return;
      }

      // Parse JSON
      if (contentType === 'application/json') {
        const bodyStr = body.toString();
        const json = bodyStr ? JSON.parse(bodyStr) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, json }));
        return;
      }

      // Fallback
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // GET /status/:code
    if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
      const code = Number.parseInt(url.pathname.split('/')[2], 10);
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: code, message: 'Status response' }));
      return;
    }

    // GET /get - Return JSON (httpbin.org style)
    if (req.method === 'GET' && url.pathname === '/get') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          args: Object.fromEntries(url.searchParams.entries()),
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
          ),
          url: url.toString(),
        }),
      );
      return;
    }

    // GET /etag/:value - Return response with ETag
    if (req.method === 'GET' && url.pathname.startsWith('/etag/')) {
      const etagValue = url.pathname.split('/')[2];
      const ifNoneMatch = req.headers['if-none-match'];

      // If client sends matching ETag, return 304
      if (ifNoneMatch === etagValue) {
        res.writeHead(304, {
          ETag: etagValue,
        });
        res.end();
        return;
      }

      // Otherwise return 200 with ETag
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ETag: etagValue,
      });
      res.end(
        JSON.stringify({
          etag: etagValue,
          url: url.toString(),
          args: Object.fromEntries(url.searchParams.entries()),
        }),
      );
      return;
    }

    // GET /cache/:seconds - Return response with Cache-Control
    if (req.method === 'GET' && url.pathname.startsWith('/cache/')) {
      const seconds = Number.parseInt(url.pathname.split('/')[2], 10);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${seconds}`,
      });
      res.end(
        JSON.stringify({
          cached: true,
          maxAge: seconds,
          url: url.toString(),
        }),
      );
      return;
    }

    // GET /response-headers - Return response with custom headers from query params
    if (req.method === 'GET' && url.pathname === '/response-headers') {
      const customHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add all query params as headers
      for (const [key, value] of url.searchParams.entries()) {
        customHeaders[key] = decodeURIComponent(value);
      }

      res.writeHead(200, customHeaders);
      res.end(
        JSON.stringify({
          headers: customHeaders,
          url: url.toString(),
        }),
      );
      return;
    }

    // GET /delay/:seconds - Add delay before responding
    if (req.method === 'GET' && url.pathname.startsWith('/delay/')) {
      const seconds = Number.parseInt(url.pathname.split('/')[2], 10);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ delayed: true, seconds }));
      return;
    }

    // GET /html - Return HTML
    if (req.method === 'GET' && url.pathname === '/html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>This is HTML, not JSON</h1></body></html>');
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
  } catch (error) {
    console.error('[ERROR]', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: String(error) }));
    }
  }
});

server.listen(PORT, () => {
  console.log('🚀 Mock HTTP Server started');
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log('📦 Endpoints: POST /post, GET /status/:code, GET /html');
  console.log('');
  console.log('Press Ctrl+C to stop');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
