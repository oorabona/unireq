# @unireq/imap

Transport IMAP avec une architecture de connecteur pluggable. Livré avec un connecteur par défaut alimenté par [`imapflow`](https://github.com/postalsys/imapflow), mais vous pouvez apporter votre propre implémentation (BYOC).

## Installation

```bash
pnpm add @unireq/imap

# Pour le connecteur par défaut (dépendance pair optionnelle)
pnpm add imapflow
```

## Panorama des exports

| Catégorie | Symboles | Objectif |
| --- | --- | --- |
| Transport | `imap(uri?, connector?)` | Crée un `TransportWithCapabilities` capable de communiquer avec des serveurs IMAP. |
| Interface connecteur | `IMAPConnector`, `IMAPSession`, `IMAPCapabilities` | Types pour implémenter des connecteurs personnalisés. |
| Connecteur par défaut | `ImapFlowConnector` | Implémentation par défaut utilisant `imapflow`. |
| Policy | `imapOperation(op, options?)` | Injecte le type d'opération et les paramètres dans le contexte de requête. |
| Auth | `xoauth2({ tokenSupplier })` | Policy d'authentification OAuth2. |
| Types | `IMAPMessage`, `IMAPEnvelope`, `SearchCriteria` | Structures de message et de recherche. |

## Démarrage rapide

```typescript
import { client } from '@unireq/core';
import { imap, imapOperation } from '@unireq/imap';

// Créer le transport (utilise ImapFlowConnector par défaut)
const { transport, capabilities } = imap('imap://user:pass@imap.gmail.com');

// Créer le client
const mail = client(transport);

// Récupérer les messages de INBOX
const messages = await mail.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));

// Rechercher les messages non lus
const ids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria: { seen: false }
}));

// Ajouter un message aux brouillons
await mail.post('/Drafts', draftContent, imapOperation('append'));
```

## Factory de transport

```typescript
import { imap, ImapFlowConnector } from '@unireq/imap';

// Option 1: Connecteur par défaut (nécessite imapflow)
const { transport } = imap('imap://user:pass@imap.gmail.com');

// Option 2: Options de connecteur personnalisées
const connector = new ImapFlowConnector({ timeout: 30000 });
const { transport } = imap('imap://imap.gmail.com', connector);

// Option 3: Apportez votre propre connecteur (BYOC)
const { transport } = imap('imap://imap.gmail.com', myCustomConnector);
```

- Utilisez `imap://` pour les connexions en clair et `imaps://` pour TLS (ports 143 et 993 respectivement).
- Les identifiants peuvent être intégrés dans l'URL; s'ils sont omis, l'authentification doit être gérée séparément.
- L'objet `capabilities` indique les opérations supportées.

## Opérations supportées

| Opération | Policy | Description |
| --- | --- | --- |
| `fetch` | `imapOperation('fetch', { mailbox, range? })` | Récupère les messages d'une boîte. Retourne `IMAPMessage[]`. |
| `select` | `imapOperation('select', { mailbox })` | Sélectionne une boîte (utile pour vérifier l'état). |
| `search` | `imapOperation('search', { mailbox, criteria })` | Recherche des messages. Retourne les UIDs. |
| `append` | `imapOperation('append', { mailbox? })` | Ajoute un message à une boîte. Retourne `{ uid }`. |
| `move` | `imapOperation('move', { mailbox, destination, range })` | Déplace des messages entre boîtes. |
| `addFlags` | `imapOperation('addFlags', { mailbox, range, flags })` | Ajoute des flags aux messages. |
| `removeFlags` | `imapOperation('removeFlags', { mailbox, range, flags })` | Supprime des flags des messages. |
| `expunge` | `imapOperation('expunge', { mailbox })` | Purge les messages supprimés. |
| `idle` | `imapOperation('idle')` | Attend les événements serveur. |

## Critères de recherche

```typescript
import { imap, imapOperation } from '@unireq/imap';
import type { SearchCriteria } from '@unireq/imap';

const criteria: SearchCriteria = {
  seen: false,           // Messages non lus
  from: 'boss@work.com', // D'un expéditeur spécifique
  since: new Date('2025-01-01'), // Après une date
  larger: 1024 * 100,    // Plus de 100Ko
};

// Combiner avec AND/OR
const complexCriteria: SearchCriteria = {
  or: [
    { from: 'alice@example.com' },
    { from: 'bob@example.com' },
  ],
  since: new Date('2025-01-01'),
};

const uids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria: complexCriteria,
}));
```

## Intégration XOAUTH2

```typescript
import { imap, imapOperation, xoauth2 } from '@unireq/imap';
import { client, compose } from '@unireq/core';

const { transport } = imap('imap://user@gmail.com@imap.gmail.com');

// Ajouter le token XOAUTH2 aux requêtes
const gmail = client(
  compose(
    transport,
    xoauth2({ tokenSupplier: () => oauthClient.getAccessToken() }),
  ),
);

await gmail.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
```

`xoauth2` résout votre token (sync ou async) juste avant l'exécution du transport. Combinez-le avec les policies de `@unireq/oauth` pour le rafraîchissement automatique.

## Facade ergonomique avec Presets

Pour une API de plus haut niveau, utilisez la facade de `@unireq/presets`:

```typescript
import { preset } from '@unireq/presets';

const mail = preset.imap
  .uri('imap://user:pass@imap.gmail.com')
  .auth({ tokenSupplier: () => getOAuthToken() })
  .retry
  .build();

// Méthodes spécifiques au domaine
const messages = await mail.fetch('INBOX', '1:*');
const uids = await mail.search('INBOX', { seen: false });
await mail.addFlags('INBOX', [1, 2, 3], ['\\Seen']);
await mail.removeFlags('INBOX', [1], ['\\Flagged']);
await mail.move('INBOX', 'Archive', [5, 6]);
await mail.expunge('INBOX');
const { uid } = await mail.append('Drafts', draftContent);

// Accès au client brut pour les opérations avancées
const raw = mail.raw;
```

## Apportez votre propre connecteur (BYOC)

Lorsque le connecteur par défaut `imapflow` ne répond pas à vos besoins, implémentez `IMAPConnector`:

```typescript
import type { IMAPConnector, IMAPSession, IMAPCapabilities } from '@unireq/imap';
import type { RequestContext, Response } from '@unireq/core';

class MyImapConnector implements IMAPConnector {
  readonly capabilities: IMAPCapabilities = {
    imap: true,
    xoauth2: true,
    idle: true,
    append: true,
    search: true,
    move: true,
    flags: true,
    expunge: true,
  };

  async connect(uri: string): Promise<IMAPSession> {
    const url = new URL(uri);
    const session = await myImapLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 993,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'imaps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      usable: true,
      secure: url.protocol === 'imaps:',
    };
  }

  async request(session: IMAPSession, context: RequestContext): Promise<Response> {
    const operation = context['operation'] as string;
    const mailbox = context['mailbox'] as string;

    switch (operation) {
      case 'fetch':
        const range = context['range'] || '1:*';
        const messages = await myImapLibrary.fetch(mailbox, range);
        return { status: 200, statusText: 'OK', headers: {}, data: messages, ok: true };

      case 'search':
        const criteria = context['criteria'];
        const uids = await myImapLibrary.search(mailbox, criteria);
        return { status: 200, statusText: 'OK', headers: {}, data: uids, ok: true };

      case 'append':
        const result = await myImapLibrary.append(mailbox, context.body);
        return { status: 200, statusText: 'OK', headers: {}, data: result, ok: true };

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

  async disconnect(session: IMAPSession): Promise<void> {
    await myImapLibrary.close();
  }
}

// Utiliser votre connecteur
const { transport } = imap('imap://server.com', new MyImapConnector());
```

### Interface IMAPConnector

```typescript
interface IMAPConnector {
  /** Capacités supportées */
  readonly capabilities: IMAPCapabilities;

  /** Établir la connexion et retourner la session */
  connect(uri: string): Promise<IMAPSession>;

  /** Exécuter l'opération IMAP */
  request(session: IMAPSession, context: RequestContext): Promise<Response>;

  /** Libérer les ressources */
  disconnect(session: IMAPSession): Promise<void> | void;
}

interface IMAPSession {
  connected: boolean;
  host: string;
  user: string;
  usable: boolean;
  secure: boolean;
}

interface IMAPCapabilities {
  readonly imap: boolean;
  readonly xoauth2: boolean;
  readonly idle: boolean;
  readonly append: boolean;
  readonly search: boolean;
  readonly move: boolean;
  readonly flags: boolean;
  readonly expunge: boolean;
}
```

### Pourquoi BYOC ?

- **Tests**: Utilisez des connecteurs mock pour les tests unitaires sans vrais serveurs IMAP
- **Enterprise**: Intégrez avec des bibliothèques mail internes qui gèrent auth/logging
- **Cas particuliers**: Supportez des comportements serveur non-standard
- **Tree-shaking**: Évitez de bundler `imapflow` si vous utilisez un connecteur personnalisé

## Cycle de vie des connexions

- Le transport se connecte paresseusement à la première requête et réutilise la session
- Les connexions sont mises en cache par triplet `host:port:user`
- Lorsque la connexion devient inutilisable (coupure réseau), le transport tente une reconnexion automatique
- Utilisez `connector.disconnect()` dans les hooks d'arrêt

## Gestion des erreurs & retries

```typescript
import { client, retry, backoff } from '@unireq/core';
import { imap, imapOperation } from '@unireq/imap';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientMail = client(
  imap('imap://imap.gmail.com').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Les erreurs réseau/auth retournent `{ ok: false, status: 500, data: { error: message } }`
- Composez avec `retry`, circuit breakers, ou `either` de `@unireq/core`
- Attention aux erreurs Gmail `APPENDLIMIT`/`RATE` — inspectez `data.error` et ajoutez du `backoff`

---

<p align="center">
  <a href="#/fr/packages/graphql">&larr; GraphQL</a> &middot; <a href="#/fr/packages/ftp">FTP &rarr;</a>
</p>
