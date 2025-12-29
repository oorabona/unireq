# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in @unireq/*, please report it by emailing the maintainer. Please do not create a public GitHub issue.

## Security Features

### JWT Signature Verification (OWASP A02:2021 - Cryptographic Failures)

**Package:** `@unireq/oauth`

The OAuth Bearer implementation includes secure JWT verification using the `jose` library:

- **JWKS Support**: Verify JWTs using JWKS URL endpoints or static PEM keys
- **Signature Validation**: Cryptographic signature verification prevents token tampering
- **Expiration Check**: Automatic token expiration validation with configurable clock skew
- **Auto-refresh**: Single-flight token refresh on 401 responses

**Usage:**

```typescript
import { oauthBearer } from '@unireq/oauth';

const authPolicy = oauthBearer({
  tokenSupplier: async () => 'eyJhbGci...',
  jwks: { type: 'url', url: 'https://example.com/.well-known/jwks.json' },
  skew: 60,
});
```

**⚠️ Security Warning:** Without the `jwks` option, only expiration is checked (no signature validation). Always provide JWKS for production use.

---

### CRLF Injection Protection (OWASP A03:2021 - Injection)

**Packages:** `@unireq/http`, `@unireq/cookies`

All header and cookie values are validated for CRLF injection attacks:

#### Headers (`@unireq/http`)

The `headers()` policy validates all header values before sending:

```typescript
import { headers } from '@unireq/http';

// Throws error if values contain \r or \n
const policy = headers({
  'X-Custom-Header': userInput, // Validated automatically
});
```

#### Cookies (`@unireq/cookies`)

The `cookieJar()` policy validates both outgoing cookies and incoming `Set-Cookie` headers:

```typescript
import { cookieJar } from '@unireq/cookies';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const policy = cookieJar(jar); // Automatic CRLF validation
```

**Protection:**
- Rejects header/cookie values containing `\r` (CR) or `\n` (LF)
- Prevents HTTP response splitting attacks
- Protects against session hijacking via cookie injection

---

### Multipart Upload Validation (OWASP A01:2021 - Broken Access Control)

**Package:** `@unireq/http`

The `multipart()` policy includes comprehensive file upload validation:

#### Features

1. **File Size Limits** - Prevent DoS attacks via large uploads
2. **MIME Type Validation** - Allow only specific file types (with wildcard support)
3. **Filename Sanitization** - Prevent path traversal attacks

**Usage:**

```typescript
import { multipart } from '@unireq/http';

const uploadPolicy = multipart(
  [{ name: 'file', filename: 'document.pdf', data: blob, contentType: 'application/pdf' }],
  [{ name: 'title', value: 'My Document' }],
  {
    maxFileSize: 10_000_000, // 10 MB
    allowedMimeTypes: ['application/pdf', 'image/*'], // PDF and all images
    sanitizeFilenames: true, // Default: true
  },
);
```

#### Filename Sanitization

Automatically applied (unless `sanitizeFilenames: false`):

- Replaces path separators (`/`, `\`) with `_`
- Removes null bytes (`\0`)
- Prevents directory traversal (`..` → `__`)

**Example:**

```
../../etc/passwd → ..__..__.._etc_passwd
file\0name.txt   → filename.txt
```

---

## OWASP Top 10 2021 Compliance

| OWASP Risk                         | Mitigation                                   | Package          |
| ---------------------------------- | -------------------------------------------- | ---------------- |
| A01:2021 - Broken Access Control   | Filename sanitization, MIME type validation  | `@unireq/http`   |
| A02:2021 - Cryptographic Failures  | JWT signature verification with jose         | `@unireq/oauth`  |
| A03:2021 - Injection               | CRLF validation for headers and cookies      | `@unireq/http`, `@unireq/cookies` |
| A04:2021 - Insecure Design         | Secure defaults (307/308 redirects only)     | `@unireq/http`   |
| A05:2021 - Security Misconfiguration | Validation enabled by default             | All packages     |

---

## Security Best Practices

### 1. Always Use HTTPS in Production

```typescript
import { httpsJsonAuthSmart } from '@unireq/presets';

const client = httpsJsonAuthSmart({
  base: 'https://api.example.com', // ✅ HTTPS
});
```

### 2. Validate JWT Signatures

```typescript
// ❌ INSECURE: No signature verification
const authPolicy = oauthBearer({
  tokenSupplier: async () => token,
});

// ✅ SECURE: Full cryptographic verification
const authPolicy = oauthBearer({
  tokenSupplier: async () => token,
  jwks: { type: 'url', url: 'https://example.com/.well-known/jwks.json' },
});
```

### 3. Configure File Upload Limits

```typescript
// ❌ Default: 100 MB max
const uploadPolicy = multipart(files);

// ✅ Custom limit for your use case
const uploadPolicy = multipart(files, fields, {
  maxFileSize: 5_000_000, // 5 MB
  allowedMimeTypes: ['image/jpeg', 'image/png'],
});
```

### 4. Use Safe Redirects

```typescript
import { redirectPolicy } from '@unireq/http';

// ✅ Default: Only 307/308 (safe redirects)
const policy = redirectPolicy();

// ⚠️ Enable 303 only if needed
const policy = redirectPolicy({ follow303: true });
```

### 5. Validate User Input

Never pass unsanitized user input directly to headers or cookies:

```typescript
// ❌ VULNERABLE
headers({ 'X-Custom': req.query.value });

// ✅ VALIDATE FIRST
const sanitized = validateAndSanitize(req.query.value);
headers({ 'X-Custom': sanitized });
```

---

## Configuration Defaults

All security-sensitive defaults are intentionally conservative:

| Feature                | Default Value | Rationale |
| ---------------------- | ------------- | --------- |
| JWT verification       | None (warns)  | Requires explicit JWKS configuration |
| Max file size          | 100 MB        | Prevents DoS via large uploads |
| Filename sanitization  | Enabled       | Prevents path traversal by default |
| CRLF validation        | Enabled       | Always enforced, cannot be disabled |
| Redirect policy        | 307/308 only  | Prevents unsafe method changes |

---

## Dependency Security

- **jose** (^5.0.0): Industry-standard JWT verification library
- **tough-cookie**: Secure cookie parsing compliant with RFC 6265
- **undici**: Node.js official HTTP client with active security maintenance

Run `pnpm audit` regularly to check for known vulnerabilities in dependencies.

---

## Security Checklist

Before deploying to production:

- [ ] JWT tokens verified with JWKS
- [ ] All API endpoints use HTTPS
- [ ] File upload limits configured appropriately
- [ ] MIME type restrictions enabled for uploads
- [ ] User input validated before passing to headers/cookies
- [ ] Dependencies up to date (`pnpm audit`)
- [ ] Rate limiting enabled (`retry()` with `rateLimitDelay()`)
- [ ] Retry policies configured with exponential backoff

---

## Updates

This security policy is reviewed and updated with each release. See [CHANGELOG.md](./CHANGELOG.md) for security-related updates.

Last updated: 2025-10-23
