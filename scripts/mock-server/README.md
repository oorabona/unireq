# 🎭 Mock HTTP Server

Serveur HTTP local qui simule les endpoints httpbin.org pour tester les exemples @unireq.

## 🚀 Démarrage rapide

```bash
# Démarrer le serveur
pnpm mock-server

# Le serveur démarre sur http://localhost:3001
```

## 📦 Endpoints disponibles

### POST /post
Simule httpbin.org/post - Accepte multipart, form urlencoded et JSON

**Multipart/form-data:**
```typescript
const response = await api.post(
  '/post',
  body.multipart(
    { name: 'file', part: body.text('content'), filename: 'file.txt' },
    { name: 'field', part: body.text('value') }
  ),
  parse.json()
);
```

**Form urlencoded:**
```typescript
const response = await api.post(
  '/post',
  body.form({ username: 'john', password: 'secret' }),
  parse.json()
);
```

**JSON:**
```typescript
const response = await api.post(
  '/post',
  body.json({ data: 'value' }),
  parse.json()
);
```

### GET /status/:code
Retourne une réponse avec le status code demandé

```bash
curl http://localhost:3001/status/200
curl http://localhost:3001/status/404
curl http://localhost:3001/status/500
```

### GET /get
Retourne des informations sur la requête (args, headers, url)

```bash
curl http://localhost:3001/get?key=value
# {"args":{"key":"value"},"headers":{...},"url":"..."}
```

### GET /etag/:value
Retourne une réponse avec ETag. Support des requêtes conditionnelles avec If-None-Match.

```bash
curl http://localhost:3001/etag/abc123
# {"etag":"abc123","url":"...","args":{}}

curl -H "If-None-Match: abc123" http://localhost:3001/etag/abc123
# 304 Not Modified
```

### GET /cache/:seconds
Retourne une réponse avec Cache-Control header

```bash
curl http://localhost:3001/cache/30
# {"cached":true,"maxAge":30,"url":"..."}
# Headers: Cache-Control: max-age=30
```

### GET /response-headers
Retourne une réponse avec les headers custom passés en query params

```bash
curl "http://localhost:3001/response-headers?Last-Modified=Thu,%2017%20Oct%202024"
# {"headers":{"Content-Type":"application/json","Last-Modified":"Thu, 17 Oct 2024"},...}
```

### GET /delay/:seconds
Ajoute un délai avant de répondre (simulation de latence)

```bash
curl http://localhost:3001/delay/2
# Attend 2 secondes puis retourne {"delayed":true,"seconds":2}
```

### GET /html
Retourne du HTML (pour tester les erreurs de parsing)

```bash
curl http://localhost:3001/html
# <html><body><h1>This is HTML, not JSON</h1></body></html>
```

## 🎯 Utilisation avec les exemples

Tous les exemples suivants utilisent maintenant le mock server local:

**Uploads multipart/form:**
- `multipart-upload.ts`
- `bulk-document-upload.ts`
- `ecommerce-product-create.ts`
- `ci-artifacts-upload.ts`
- `email-with-attachments.ts`
- `form-submission.ts`

**Interceptors:**
- `interceptors-logging.ts`
- `interceptors-metrics.ts`
- `interceptors-cache.ts`

**Conditional requests (ETag, Last-Modified):**
- `conditional-etag.ts`
- `conditional-lastmodified.ts`
- `conditional-combined.ts`

Le script `pnpm examples:all` démarre automatiquement le serveur avant d'exécuter les exemples.

## 🔧 Développement

### Structure
```
scripts/mock-server/
├── server.ts              # Serveur HTTP Node.js natif
├── handlers.ts            # Handlers MSW (backup)
├── graphql-handlers.ts    # Handlers GraphQL (backup)
└── README.md              # Documentation
```

### Ajouter un endpoint

Éditez `server.ts` et ajoutez votre handler:

```typescript
if (req.method === 'GET' && url.pathname === '/custom') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Custom endpoint' }));
  return;
}
```

## 📝 Notes

### MSW vs Serveur HTTP natif

Ce mock server utilise Node.js natif (`http.createServer`) **uniquement pour les exemples** car MSW est conçu pour intercepter les requêtes dans le même processus, pas pour démarrer un serveur standalone HTTP réel.

**Pour les tests unitaires**, MSW fonctionne parfaitement ! Par exemple :
- ✅ **HTTP/2** : 21 tests avec `vi.mock('node:http2')`
- ✅ **FTP** : 24 tests avec `vi.mock('basic-ftp')`
- ✅ **IMAP** : 20 tests avec `vi.mock('imap-simple')`

Les tests unitaires n'ont pas besoin de serveur réel car ils mockent directement les modules natifs Node.js.

### Fichiers de référence

- Les handlers MSW (`handlers.ts`, `graphql-handlers.ts`) sont conservés comme backup et documentation
- Le parsing multipart est simplifié (extraction basique des noms de fichiers et champs)
- Pour un parsing multipart robuste, envisagez d'utiliser `busboy` ou `formidable`

## ⚠️ Production

**Ce serveur est uniquement pour les tests et exemples. Ne l'utilisez PAS en production.**

Pour les tests unitaires, utilisez MSW avec `setupServer()` qui intercepte les requêtes sans serveur HTTP réel.
