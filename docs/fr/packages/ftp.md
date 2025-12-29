# @unireq/ftp

Transport FTP/FTPS avec une architecture de connecteur pluggable. Livré avec un connecteur par défaut alimenté par [`basic-ftp`](https://github.com/patrickjuchli/basic-ftp), mais vous pouvez apporter votre propre implémentation (BYOC).

## Installation

```bash
pnpm add @unireq/ftp

# Pour le connecteur par défaut (dépendance pair optionnelle)
pnpm add basic-ftp
```

## Panorama des exports

| Catégorie | Symboles | Objectif |
| --- | --- | --- |
| Transport | `ftp(uri?, connector?)` | Crée un `TransportWithCapabilities` capable de communiquer avec des serveurs FTP/FTPS. |
| Interface connecteur | `FTPConnector`, `FTPSession`, `FTPCapabilities` | Types pour implémenter des connecteurs personnalisés. |
| Connecteur par défaut | `BasicFtpConnector` | Implémentation par défaut utilisant `basic-ftp`. |
| Policy | `ftpOperation(op, extras?)` | Injecte le type d'opération et les paramètres dans le contexte de requête. |
| Types | `FTPFileEntry` | Structure d'entrée pour le listing de fichiers. |

## Démarrage rapide

```typescript
import { client } from '@unireq/core';
import { ftp, ftpOperation } from '@unireq/ftp';

// Créer le transport (utilise BasicFtpConnector par défaut)
const { transport, capabilities } = ftp('ftp://user:pass@ftp.example.com');

// Créer le client
const ftpClient = client(transport);

// Lister un répertoire
const listing = await ftpClient.get('/public', ftpOperation('list'));

// Télécharger un fichier
const data = await ftpClient.get('/reports/today.csv', ftpOperation('get'));

// Uploader un fichier
await ftpClient.put('/uploads/report.json', { data: 'contenu' }, ftpOperation('put'));
```

## Factory de transport

```typescript
import { ftp, BasicFtpConnector } from '@unireq/ftp';

// Option 1: Connecteur par défaut (nécessite basic-ftp)
const { transport } = ftp('ftp://user:pass@ftp.example.com');

// Option 2: Options de connecteur personnalisées
const connector = new BasicFtpConnector({ timeout: 30000 });
const { transport } = ftp('ftp://ftp.example.com', connector);

// Option 3: Apportez votre propre connecteur (BYOC)
const { transport } = ftp('ftp://ftp.example.com', myCustomConnector);
```

- Utilisez `ftp://` pour les connexions en clair et `ftps://` pour TLS (ports 21 et 990 respectivement).
- Les identifiants peuvent être intégrés dans l'URL; s'ils sont omis, `anonymous/anonymous` est utilisé.
- L'objet `capabilities` indique les opérations supportées.

## Opérations supportées

| Opération | Policy | Données retournées |
| --- | --- | --- |
| `list` | `ftpOperation('list')` | `FTPFileEntry[]` avec `name`, `type`, `size` |
| `get` | `ftpOperation('get')` | `Buffer` avec le contenu du fichier |
| `put` | `ftpOperation('put')` | `{ uploaded: boolean }` |
| `delete` | `ftpOperation('delete')` | `{ deleted: boolean, path: string }` |
| `rename` | `ftpOperation('rename', { destination })` | `{ renamed: boolean, from, to }` |
| `mkdir` | `ftpOperation('mkdir')` | `{ created: boolean, path }` |
| `rmdir` | `ftpOperation('rmdir')` | `{ removed: boolean, path }` |

## Facade ergonomique avec Presets

Pour une API de plus haut niveau, utilisez la facade de `@unireq/presets`:

```typescript
import { preset } from '@unireq/presets';

const ftp = preset.ftp
  .uri('ftp://user:pass@ftp.example.com')
  .retry
  .build();

// Méthodes spécifiques au domaine
const files = await ftp.list('/public');
const content = await ftp.download('/file.txt');
await ftp.upload('/new-file.txt', 'contenu');
await ftp.mkdir('/new-folder');
await ftp.rename('/old.txt', '/new.txt');
await ftp.delete('/temp.txt');
await ftp.rmdir('/empty-folder');

// Accès au client brut pour les opérations avancées
const raw = ftp.raw;
```

## Apportez votre propre connecteur (BYOC)

Lorsque le connecteur par défaut `basic-ftp` ne répond pas à vos besoins, implémentez `FTPConnector`:

```typescript
import type { FTPConnector, FTPSession, FTPCapabilities } from '@unireq/ftp';
import type { RequestContext, Response } from '@unireq/core';

class MyFtpConnector implements FTPConnector {
  readonly capabilities: FTPCapabilities = {
    ftp: true,
    ftps: true,
    delete: true,
    rename: true,
    mkdir: true,
    rmdir: true,
  };

  async connect(uri: string): Promise<FTPSession> {
    const url = new URL(uri);
    const session = await myFtpLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 21,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'ftps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      secure: url.protocol === 'ftps:',
    };
  }

  async request(session: FTPSession, context: RequestContext): Promise<Response> {
    const operation = context['operation'] as string;

    switch (operation) {
      case 'list':
        const files = await myFtpLibrary.list(context.url);
        return { status: 200, statusText: 'OK', headers: {}, data: files, ok: true };

      case 'get':
        const buffer = await myFtpLibrary.download(context.url);
        return { status: 200, statusText: 'OK', headers: {}, data: buffer, ok: true };

      case 'put':
        await myFtpLibrary.upload(context.url, context.body);
        return { status: 200, statusText: 'OK', headers: {}, data: { uploaded: true }, ok: true };

      // ... gérer les autres opérations

      default:
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          data: { error: `Opération non supportée: ${operation}` },
          ok: false,
        };
    }
  }

  disconnect(): void {
    myFtpLibrary.close();
  }
}

// Utiliser votre connecteur
const { transport } = ftp('ftp://server.com', new MyFtpConnector());
```

### Interface FTPConnector

```typescript
interface FTPConnector {
  /** Capacités supportées */
  readonly capabilities: FTPCapabilities;

  /** Établir la connexion et retourner la session */
  connect(uri: string): Promise<FTPSession>;

  /** Exécuter l'opération FTP */
  request(session: FTPSession, context: RequestContext): Promise<Response>;

  /** Libérer les ressources */
  disconnect(): void;
}

interface FTPSession {
  connected: boolean;
  host: string;
  user: string;
  secure: boolean;
}

interface FTPCapabilities {
  readonly ftp: boolean;
  readonly ftps: boolean;
  readonly delete: boolean;
  readonly rename: boolean;
  readonly mkdir: boolean;
  readonly rmdir: boolean;
}
```

### Pourquoi BYOC ?

- **Tests**: Utilisez des connecteurs mock pour les tests unitaires sans vrais serveurs FTP
- **Enterprise**: Intégrez avec des bibliothèques internes qui gèrent auth/logging
- **Cas particuliers**: Supportez des comportements FTP non-standard
- **Tree-shaking**: Évitez de bundler `basic-ftp` si vous utilisez un connecteur personnalisé

## Cycle de vie des connexions

- Le transport se connecte paresseusement à la première requête et réutilise la session
- Les connexions sont mises en cache par triplet `host:port:user`
- Le transport ne ferme jamais les connexions automatiquement; liez le nettoyage à votre cycle de vie applicatif
- Utilisez `connector.disconnect()` dans les hooks d'arrêt

## Gestion des erreurs & retries

```typescript
import { client, retry, backoff } from '@unireq/core';
import { ftp, ftpOperation } from '@unireq/ftp';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientFtp = client(
  ftp('ftp://ftp.example.com').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Les erreurs réseau/auth retournent `{ ok: false, status: 500, data: { error: message } }`
- Composez avec `retry`, circuit breakers, ou `either` de `@unireq/core`

---

<p align="center">
  <a href="#/fr/packages/imap">&larr; IMAP</a> &middot; <a href="#/fr/packages/presets">Presets &rarr;</a>
</p>
