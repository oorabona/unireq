# Pourquoi unireq pour Tous les Protocoles

Vous vous demandez peut-être : unireq a-t-il vraiment du sens pour les protocoles connectés comme IMAP, SMTP et FTP ? Après tout, HTTP est stateless et "fire-and-forget", alors que ces protocoles maintiennent des sessions persistantes.

**Réponse courte** : Oui, et voici pourquoi.

## La Métaphore HTTP ne Colle Pas Parfaitement

Soyons honnêtes. L'API style HTTP est naturelle pour HTTP :

```typescript
// HTTP - parfaitement logique
await client.get('/users/123');
await client.post('/orders', { items: [...] });
```

Mais pour IMAP, c'est plus forcé :

```typescript
// IMAP - l'abstraction se voit
await client.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
```

Les verbes (GET/POST) et les URLs ne correspondent pas naturellement aux commandes IMAP. C'est pourquoi nous fournissons des **facades spécifiques au protocole** :

```typescript
// Avec facade - API naturelle
const inbox = preset.imap.uri('imap://...').retry.build();
await inbox.fetch('INBOX', '1:10');
await inbox.search('INBOX', { seen: false });
```

## Ce qu'unireq Apporte Réellement

### 1. Policies Transversales — Le Vrai Gain

Ces préoccupations sont **identiques** quel que soit le protocole :

```typescript
const resilientMail = client(
  imap('imap://...').transport,
  retry(predicate, [backoff({ initial: 1000 })], { tries: 3 }),
  timeout(30000),
  logging({ level: 'debug' }),
  circuitBreaker({ threshold: 5 }),
);
```

Que tu envoies un email ou que tu appelles une API REST :
- **Retry** en cas d'échec réseau
- **Timeout** si ça prend trop longtemps
- **Log** ce qui se passe
- **Circuit breaker** si le serveur est down

Avant unireq, chaque bibliothèque réimplémentait ces fonctionnalités :
- `nodemailer` a son propre retry
- `imapflow` a son propre timeout
- `basic-ftp` a sa propre gestion d'erreurs

Avec unireq, tu composes une seule fois.

### 2. BYOC (Bring Your Own Connector) — Testing & Flexibilité

```typescript
// Test sans serveur SMTP réel
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

C'est **énorme** pour le testing :
- Tester ton code sans vrais serveurs Gmail/IMAP
- Simuler des erreurs réseau
- Vérifier le comportement des retries
- Remplacer `nodemailer` par `sendgrid` sans changer ton code

### 3. Uniformité de l'Écosystème

```typescript
// Même pattern, même modèle mental
const http = preset.http.uri('https://api.com').retry.build();
const mail = preset.smtp.uri('smtp://gmail.com').retry.build();
const inbox = preset.imap.uri('imap://gmail.com').retry.build();
const files = preset.ftp.uri('ftp://server.com').retry.build();

// Même gestion d'erreurs partout
const result = await mail.send(...);
if (!result.ok) { /* gérer l'erreur */ }
```

**Un seul pattern à apprendre** = onboarding plus rapide pour ton équipe.

## Cycle de Vie des Connexions pour les Protocoles Stateful

Contrairement à HTTP, IMAP/SMTP/FTP maintiennent des connexions persistantes. Voici comment unireq les gère :

### Connexion Lazy

La connexion est établie à la **première requête**, pas à la création du client :

```typescript
const inbox = preset.imap.uri('imap://...').build();
// Pas encore de connexion

const messages = await inbox.fetch('INBOX', '1:10');
// Connexion établie ici, puis réutilisée
```

### Réutilisation de Session

Toutes les commandes suivantes utilisent la **même session** :

```typescript
await inbox.fetch('INBOX', '1:10');    // Utilise la session
await inbox.search('INBOX', { ... });  // Réutilise la même session
await inbox.move('INBOX', 'Archive', [1, 2, 3]); // Toujours la même session
```

C'est plus efficace que de se reconnecter à chaque opération.

### Arrêt Propre

Pour les applications long-running, déconnectez dans vos hooks de shutdown :

```typescript
// Le transport gère le cleanup à la fermeture du process
process.on('SIGTERM', async () => {
  console.log('Arrêt en cours...');
  process.exit(0);
});
```

### Reconnexion Automatique

Si la connexion est coupée (problème réseau), le transport tente une reconnexion à la prochaine requête. Combiné avec les policies `retry`, ton application reste résiliente :

```typescript
const inbox = preset.imap
  .uri('imap://...')
  .retry  // Les retries incluent les tentatives de reconnexion
  .build();
```

## L'Architecture qui Rend Cela Possible

```
┌─────────────────────────────────────────────────────┐
│                   Ton Code                          │
│         inbox.fetch('INBOX', '1:10')               │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Facade Protocole                       │
│    ImapFacade / SmtpFacade / FtpFacade             │
│    (API naturelle, spécifique au domaine)          │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                 Policies                            │
│    retry() + backoff() + timeout() + logging()     │
│    (Composables, agnostiques au protocole)         │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                Transport                            │
│         (ctx) => Promise<Response>                  │
│    (Gère la connexion, traduit vers le protocole)  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                Connector (BYOC)                     │
│    ImapFlowConnector / NodemailerConnector / ...   │
│    (Implémentation réelle du protocole)            │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
                   [ Réseau ]
```

1. **Transport** = fonction `(ctx) => Promise<Response>`
2. **Interface Connector** = `connect()` / `request()` / `disconnect()`
3. **Policies** = middleware composables
4. **Facades** = API spécifique au domaine par-dessus

## Résumé

| Bénéfice | Impact |
|----------|--------|
| Policies réutilisables (retry, timeout, logging) | ⭐⭐⭐⭐⭐ |
| BYOC pour le testing | ⭐⭐⭐⭐⭐ |
| API unifiée (un seul pattern à apprendre) | ⭐⭐⭐⭐ |
| Composabilité (IMAP + SMTP dans le même flow) | ⭐⭐⭐⭐ |
| Gestion de connexion abstraite | ⭐⭐⭐ |

La métaphore HTTP est légèrement forcée pour les protocoles connectés, mais les bénéfices — policies réutilisables, testabilité via BYOC, et cohérence de l'écosystème — justifient l'approche. Les facades spécifiques au protocole offrent une DX naturelle tout en exploitant la puissance de composition en dessous.

---

<p align="center">
  <a href="#/fr/concepts/composition">&larr; Composition</a> &middot; <a href="#/fr/concepts/body-parsing">Parsing du Body &rarr;</a>
</p>
