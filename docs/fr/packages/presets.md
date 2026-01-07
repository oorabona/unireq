# @unireq/presets

Clients pré-configurés et helpers prêts à l'emploi pour composer rapidement transports + policies.

## Installation

```bash
pnpm add @unireq/presets
```

## Panorama des exports

| Helper | Description |
| --- | --- |
| `httpClient(baseUrl?, options?)` | **Client HTTP simple** avec valeurs par défaut sensées (JSON, redirects, timeout, headers). |
| `httpsJsonAuthSmart(uri, options)` | Client HTTPS avec négociation JSON/XML, redirects sûrs, retry/backoff, OAuth optionnel. |
| `httpUploadGeneric(uri?, options?)` | Client HTTP minimal pour les uploads (ajoutez vos policies). |
| `createMultipartUpload(files, fields?, options?)` | Helper autour de `body.multipart` avec validations. |
| `httpDownloadResume(uri, resumeStateOrOptions?)` | Client HTTP configuré pour les téléchargements range/reprise. |
| `gmailImap(tokenSupplier)` | Policy XOAUTH2 + `SELECT INBOX` pour IMAP (Gmail).
| `multipart`, `resume`, `MultipartFile`, … | Re-export des utilitaires @unireq/http pour éviter les imports multiples.

## httpClient (Client HTTP simple)

Le moyen le plus simple de créer un client HTTP avec des valeurs par défaut sensées :

```ts
import { httpClient } from '@unireq/presets';

// Usage minimal
const api = httpClient('https://api.example.com');
const user = await api.get('/users/42');

// Avec options
const api = httpClient('https://api.example.com', {
  timeout: 10000,
  headers: { 'X-API-Key': 'secret' },
  json: true,           // défaut: true
  followRedirects: true, // défaut: true
  policies: [customLogging()],
});

// Méthodes safe (retournent Result au lieu de lever des exceptions)
const result = await api.safe.get('/users/42');
if (result.isOk()) {
  console.log(result.value.data);
}
```

### Options

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `timeout` | `number` | - | Timeout en millisecondes |
| `headers` | `Record<string, string>` | - | Headers par défaut pour toutes les requêtes |
| `json` | `boolean` | `true` | Parser automatiquement les réponses JSON |
| `followRedirects` | `boolean` | `true` | Suivre les redirections 307/308 |
| `policies` | `Policy[]` | `[]` | Policies additionnelles à appliquer |

### Quand l'utiliser

- **httpClient** : Prototypage rapide, appels API simples, quand vous voulez des valeurs par défaut sensées
- **httpsJsonAuthSmart** : Applications production nécessitant OAuth, retry, rate limiting
- **Client personnalisé** : Contrôle total sur la composition des policies

## httpsJsonAuthSmart

```ts
import { httpsJsonAuthSmart } from '@unireq/presets';

const api = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
  allowUnsafeMode: false,
  policies: [customMetrics()],
});

const profil = await api.get('/me');
```

- `accept(['application/json', 'application/xml'])`, `redirectPolicy({ allow: [307, 308] })`, `retry(httpRetryPredicate(...))` avec `rateLimitDelay` + `backoff` sont déjà en place.
- Ajoute `oauthBearer` uniquement si `tokenSupplier` est fourni.
- Vous pouvez empiler d'autres policies via `options.policies` (elles s'appliquent juste avant le transport).

## httpUploadGeneric & createMultipartUpload

```ts
import { httpUploadGeneric, createMultipartUpload } from '@unireq/presets';

const uploader = httpUploadGeneric('https://uploads.example.com');

await uploader.post(
  '/files',
  createMultipartUpload([
    { name: 'file', filename: 'doc.pdf', part: body.binary(buffer, 'application/pdf') },
  ]),
);
```

- `httpUploadGeneric` retourne simplement `client(http(uri), ...policies)` ; ajoutez vos couches (auth, logs) selon le modèle [composition](../fr/concepts/composition.md).
- `createMultipartUpload` applique les validations `MultipartValidationOptions` avant d'envoyer la requête.

## httpDownloadResume

```ts
import { httpDownloadResume } from '@unireq/presets';

const downloader = httpDownloadResume('https://cdn.example.com', { resumeState: { downloaded: 5_000 } });
const chunk = await downloader.get('/video.mp4');
```

- Injecte automatiquement `range/resume` pour reprendre un téléchargement à partir de `resumeState.downloaded` lorsque `Accept-Ranges: bytes` est présent.
- Ajoutez des policies (hash, logs) via `options.policies`.

## gmailImap

```ts
import { gmailImap } from '@unireq/presets';
import { client } from '@unireq/core';
import { imap } from '@unireq/imap';

const gmail = client(imap({ host: 'imap.gmail.com', port: 993 }), gmailImap(() => getGmailToken()));
const inbox = await gmail.list();
```

- S'appuie sur `xoauth2` de `@unireq/imap` et sélectionne `INBOX` par défaut.
- Servez-vous-en comme base pour vos propres policies IMAP.

## Choisir le bon helper

| Helper | Transport | OAuth | Retry/backoff | Rate limit | Négociation de contenu |
| --- | --- | --- | --- | --- | --- |
| `httpsJsonAuthSmart` | HTTP/HTTPS | Optionnel | ✅ | ✅ (`Retry-After`) | JSON ↔ XML |
| `httpUploadGeneric` | HTTP/HTTPS | À ajouter | ❌ | ❌ | Dépend de vos policies |
| `httpDownloadResume` | HTTP/HTTPS | N/A | ❌ | ❌ | Flux binaire |
| `gmailImap` | IMAP | ✅ (XOAUTH2) | ❌ | ❌ | Réponses IMAP |

Besoin d'un autre assemblage ? Consultez [packages/presets/src](../packages/presets/src) et réutilisez la même recette dans votre code.

---

<p align="center">
  <a href="#/fr/packages/ftp">← FTP</a> · <a href="#/fr/packages/config">Config →</a>
</p>