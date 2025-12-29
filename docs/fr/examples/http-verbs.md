# Verbes HTTP en Pratique

Tour d'horizon de `GET`, `POST`, `PUT`, `PATCH`, `DELETE` et `OPTIONS` avec un seul client Unireq. Chaque extrait reflète le script exécutable `examples/http-verbs.ts`.

## Points clés

- ✅ Un client unique, des policies ponctuelles par verbe
- ✅ Montre quand utiliser `body.*`, les clés d'idempotence et les headers conditionnels
- ✅ Démonstration de `options()` pour les prévols CORS

## Exécuter l'exemple

```bash
pnpm example:http-verbs
```

## Mise en place

```typescript
import { client } from '@unireq/core';
import { body, headers, http, parse } from '@unireq/http';

type HttpBinEcho<T = unknown> = {
  args: Record<string, string>;
  headers: Record<string, string>;
  json: T;
  method: string;
  url: string;
};

const api = client(http('https://httpbin.org'), headers({ 'user-agent': 'unireq-http-verbs/1.0' }));
```

## HEAD — inspecter les métadonnées

```typescript
const head = await api.head('/bytes/1024', parse.raw());
const expectedLength = Number(head.headers['content-length'] ?? 0);

const download = await api.get<ArrayBuffer>('/bytes/1024', parse.binary());
console.log('Octets attendus vs reçus:', expectedLength, download.data.byteLength);
```

- HEAD ne renvoie que les en-têtes, donc `parse.raw()` est suffisant.
- Vous pouvez ensuite réutiliser ces en-têtes (`Content-Length`, `ETag`, etc.) pour un GET conditionnel.

## GET — lecture

```typescript
const response = await api.get<HttpBinEcho>('/get', headers({ 'x-trace-id': crypto.randomUUID() }), parse.json());
console.log(response.data.args);
```

- `headers()` s'ajoute par requête pour tracer les appels.
- Idéal avec `retry()` car l'opération reste idempotente.

## POST — création

```typescript
const payload = { email: 'jane@example.com', name: 'Jane' };
const response = await api.post<HttpBinEcho<typeof payload>>(
  '/anything',
  body.json(payload),
  headers({ 'x-idempotency-key': crypto.randomUUID() }),
  parse.json(),
);
```

- `body.json()` encode et pose `Content-Type` automatiquement.
- Ajoutez un header d'idempotence pour laisser le serveur dédupliquer les retries.

## PUT — remplacement complet

```typescript
await api.put<HttpBinEcho<{ id: number; role: string }>>(
  '/anything/profile',
  body.json({ id: 42, role: 'admin' }),
  headers({ 'if-match': 'W/"profile-v1"' }),
  parse.json(),
);
```

- Combinez avec `etag()` ou `If-Match` pour éviter les pertes de mises à jour.
- PUT est idempotent → compatible avec les retries contrôlés.

## PATCH — mise à jour partielle

```typescript
await api.patch<HttpBinEcho<{ role: string }>>('/anything/profile', body.json({ role: 'editor' }), parse.json());
```

- Ajustez `Content-Type` (`merge-patch`, `json-patch`) selon les conventions du backend.
- Parfait pour brancher vos helpers de validation avant l'envoi.

## DELETE — suppression

```typescript
await api.delete<HttpBinEcho>('/anything/session', headers({ 'x-confirm-delete': 'true' }), parse.json());
```

- Beaucoup d'APIs répondent `204`; utilisez `parse.raw()` si vous n'attendez pas de corps.
- Les headers applicatifs évitent les suppressions accidentelles.

## OPTIONS — capacités / prévol

```typescript
const response = await api.options('/anything', headers({ Origin: 'https://docs.unireq.dev' }), parse.raw());
console.log(response.headers['allow']);
console.log(response.headers['access-control-allow-methods']);
```

- Utile pour connaître les verbes autorisés ou valider un flux CORS.
- Les réponses OPTIONS sont souvent vides : `parse.raw()` évite les erreurs de parsing JSON et vous concentre sur les headers.
- Mettez en cache la réponse avec `conditional()` si le serveur fournit des métadonnées stables.

## Script complet

```typescript
import { client } from '@unireq/core';
import { body, headers, http, parse } from '@unireq/http';

type HttpBinEcho<T = unknown> = {
  args: Record<string, string>;
  headers: Record<string, string>;
  json: T;
  method: string;
  url: string;
};

const api = client(http('https://httpbin.org'), headers({ 'user-agent': 'unireq-http-verbs/1.0' }));

async function demoHeadBeforeGet() {
  console.log('\n=== HEAD + GET /bytes/1024 ===');
  const headResponse = await api.head('/bytes/1024', parse.raw());
  const expectedLength = Number(headResponse.headers['content-length'] ?? 0);
  console.log('HEAD Content-Length :', expectedLength);

  const download = await api.get<ArrayBuffer>('/bytes/1024', parse.binary());
  console.log('GET bytes téléchargés :', download.data.byteLength);
}

async function demoGet() {
  console.log('\n=== GET /get ===');
  const response = await api.get<HttpBinEcho>('/get', headers({ 'x-trace-id': crypto.randomUUID() }), parse.json());
  console.log('Status:', response.status);
  console.log('Args:', response.data.args);
}

async function demoPost() {
  console.log('\n=== POST /anything ===');
  const payload = { email: 'jane@example.com', name: 'Jane' };
  const response = await api.post<HttpBinEcho<typeof payload>>(
    '/anything',
    body.json(payload),
    headers({ 'x-idempotency-key': crypto.randomUUID() }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Echoed JSON:', response.data.json);
}

async function demoPut() {
  console.log('\n=== PUT /anything/profile ===');
  const response = await api.put<HttpBinEcho<{ id: number; role: string }>>(
    '/anything/profile',
    body.json({ id: 42, role: 'admin' }),
    headers({ 'if-match': 'W/"profile-v1"' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Headers sent:', response.data.headers);
}

async function demoPatch() {
  console.log('\n=== PATCH /anything/profile ===');
  const response = await api.patch<HttpBinEcho<{ role: string }>>(
    '/anything/profile',
    body.json({ role: 'editor' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('JSON delta:', response.data.json);
}

async function demoDelete() {
  console.log('\n=== DELETE /anything/session ===');
  const response = await api.delete<HttpBinEcho>(
    '/anything/session',
    headers({ 'x-confirm-delete': 'true' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Was JSON returned?', Boolean(response.data.json));
}

async function demoOptions() {
  console.log('\n=== OPTIONS /anything ===');
  const response = await api.options('/anything', headers({ Origin: 'https://docs.unireq.dev' }), parse.raw());
  console.log('Status:', response.status);
  console.log('Allow header:', response.headers['allow']);
  console.log('CORS methods:', response.headers['access-control-allow-methods']);
}

async function main() {
  await demoHeadBeforeGet();
  await demoGet();
  await demoPost();
  await demoPut();
  await demoPatch();
  await demoDelete();
  await demoOptions();
}

main().catch((error) => {
  console.error('❌ HTTP verbs demo failed:', error);
  process.exitCode = 1;
});
```

---

<p align="center">
  <a href="#/fr/examples/interceptors">← Intercepteurs</a> · <a href="#/fr/examples/streaming">Streaming →</a>
</p>
