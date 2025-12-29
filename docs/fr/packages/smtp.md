# @unireq/smtp

Transport SMTP avec une architecture de connecteur pluggable. Livré avec un connecteur par défaut basé sur [`nodemailer`](https://nodemailer.com/), mais vous pouvez apporter votre propre implémentation (BYOC).

## Installation

```bash
pnpm add @unireq/smtp

# Pour le connecteur par défaut (dépendance optionnelle)
pnpm add nodemailer
```

## Aperçu des Exports

| Catégorie | Symboles | Objectif |
| --- | --- | --- |
| Transport | `smtp(uri?, connector?)` | Crée un `TransportWithCapabilities` qui sait envoyer des emails. |
| Interface connecteur | `SMTPConnector`, `SMTPSession`, `SMTPCapabilities` | Types pour implémenter des connecteurs personnalisés. |
| Connecteur par défaut | `NodemailerConnector` | Implémentation par défaut utilisant la bibliothèque `nodemailer`. |
| Types | `EmailMessage`, `EmailAttachment`, `SendResult` | Structures de composition d'emails. |

## Démarrage Rapide

```typescript
import { client } from '@unireq/core';
import { smtp } from '@unireq/smtp';

// Créer le transport (utilise NodemailerConnector par défaut)
const { transport, capabilities } = smtp('smtp://user:pass@smtp.gmail.com:587');

// Créer le client
const mail = client(transport);

// Envoyer un email
const result = await mail.post<SendResult>('/', {
  from: 'moi@gmail.com',
  to: 'vous@example.com',
  subject: 'Bonjour !',
  text: 'Ceci est un email de test.',
});
```

## Factory de Transport

```typescript
import { smtp, NodemailerConnector } from '@unireq/smtp';

// Option 1 : Connecteur par défaut (nécessite nodemailer)
const { transport } = smtp('smtp://user:pass@smtp.gmail.com:587');

// Option 2 : SMTPS (TLS implicite sur le port 465)
const { transport } = smtp('smtps://user:pass@smtp.gmail.com:465');

// Option 3 : Avec OAuth2
const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
  oauth2: {
    clientId: 'votre-client-id',
    clientSecret: 'votre-client-secret',
    refreshToken: 'votre-refresh-token',
  },
});

// Option 4 : Apportez Votre Propre Connecteur (BYOC)
const { transport } = smtp('smtp://smtp.example.com', myCustomConnector);
```

- Utilisez `smtp://` pour STARTTLS (port 587) et `smtps://` pour TLS implicite (port 465)
- Les identifiants peuvent être intégrés dans l'URL
- L'objet `capabilities` indique les fonctionnalités supportées

## Format des Messages Email

```typescript
import type { EmailMessage, EmailAttachment } from '@unireq/smtp';

const message: EmailMessage = {
  // Champs obligatoires
  from: 'expediteur@example.com',
  to: 'destinataire@example.com',
  subject: 'Sujet de l\'email',

  // Corps (text, html, ou les deux)
  text: 'Corps en texte brut',
  html: '<h1>Corps HTML</h1>',

  // Champs optionnels
  cc: 'cc@example.com',
  bcc: ['bcc1@example.com', 'bcc2@example.com'],
  replyTo: 'reponse@example.com',
  priority: 'high', // 'high' | 'normal' | 'low'
  headers: { 'X-Custom-Header': 'valeur' },

  // Pièces jointes
  attachments: [
    {
      filename: 'document.pdf',
      content: bufferOrString,
      contentType: 'application/pdf',
    },
    {
      filename: 'image-inline.png',
      content: imageBuffer,
      contentType: 'image/png',
      cid: 'image1', // Pour l'intégration inline : <img src="cid:image1">
      disposition: 'inline',
    },
  ],
};
```

### Adresses Nommées

```typescript
const message: EmailMessage = {
  from: { name: 'Nom Expéditeur', address: 'expediteur@example.com' },
  to: [
    { name: 'Destinataire 1', address: 'r1@example.com' },
    { name: 'Destinataire 2', address: 'r2@example.com' },
  ],
  subject: 'Bonjour !',
  text: 'Corps du message',
};
```

## Résultat d'Envoi

```typescript
interface SendResult {
  /** Destinataires qui ont accepté l'email */
  accepted: string[];

  /** Destinataires qui ont refusé l'email */
  rejected: string[];

  /** Identifiant unique du message */
  messageId: string;

  /** Réponse du serveur SMTP */
  response: string;
}
```

## Authentification Gmail

Gmail nécessite une configuration d'authentification spéciale. Choisissez l'une de ces méthodes :

### Option 1 : Mot de passe d'application (Recommandé pour le développement)

1. Activez la validation en 2 étapes sur votre compte Google
2. Allez sur [Mots de passe d'application Google](https://myaccount.google.com/apppasswords)
3. Créez un mot de passe d'application pour "Mail"
4. Utilisez le mot de passe de 16 caractères dans votre URI

```typescript
const { transport } = smtp('smtp://votre@gmail.com:xxxx-xxxx-xxxx-xxxx@smtp.gmail.com:587');
```

**Note de sécurité** : Les mots de passe d'application donnent un accès complet à la messagerie. Utilisez-les uniquement dans des environnements sécurisés.

### Option 2 : OAuth2 (Recommandé pour la production)

1. Créez un projet dans [Google Cloud Console](https://console.cloud.google.com/)
2. Activez l'API Gmail
3. Créez des identifiants OAuth2 (type Application de bureau pour les apps CLI)
4. Obtenez le refresh token via le flux OAuth

```typescript
const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
  oauth2: {
    clientId: 'votre-client-id.apps.googleusercontent.com',
    clientSecret: 'votre-client-secret',
    refreshToken: 'votre-refresh-token',
  },
});
```

### Configuration Serveur Gmail

| Protocole | Hôte | Port | Sécurité |
| --- | --- | --- | --- |
| IMAP | imap.gmail.com | 993 | SSL/TLS |
| SMTP | smtp.gmail.com | 587 | STARTTLS |
| SMTP | smtp.gmail.com | 465 | SSL/TLS |

## Façade Ergonomique avec Presets

Pour une API de plus haut niveau, utilisez la façade de `@unireq/presets` :

```typescript
import { preset } from '@unireq/presets';

const mail = preset.smtp
  .uri('smtp://user:app-password@smtp.gmail.com:587')
  .retry
  .build();

// Méthodes simples
await mail.send({
  from: 'moi@gmail.com',
  to: 'vous@example.com',
  subject: 'Bonjour !',
  text: 'Corps du message',
});

// Raccourci pour emails texte
await mail.sendText('destinataire@example.com', 'Sujet', 'Corps du texte');

// Raccourci pour emails HTML
await mail.sendHtml('destinataire@example.com', 'Sujet', '<h1>Bonjour</h1>', 'Texte de secours');

// Accès au client brut pour les opérations avancées
const raw = mail.raw;
```

### Façade avec OAuth2

```typescript
const mail = preset.smtp
  .uri('smtp://user@gmail.com@smtp.gmail.com:587')
  .oauth2({
    clientId: 'votre-client-id',
    clientSecret: 'votre-client-secret',
    refreshToken: 'votre-refresh-token',
  })
  .retry
  .build();
```

### Définir l'adresse "From" par défaut

```typescript
const mail = preset.smtp
  .uri('smtp://smtp.gmail.com:587')
  .from('noreply@company.com')
  .retry
  .build();

// Pas besoin de spécifier "from" dans chaque email
await mail.sendText('destinataire@example.com', 'Sujet', 'Corps');
```

## Apportez Votre Propre Connecteur (BYOC)

Quand le connecteur `nodemailer` par défaut ne répond pas à vos besoins, implémentez `SMTPConnector` :

```typescript
import type { SMTPConnector, SMTPSession, SMTPCapabilities } from '@unireq/smtp';
import type { RequestContext, Response } from '@unireq/core';

class MySMTPConnector implements SMTPConnector {
  readonly capabilities: SMTPCapabilities = {
    smtp: true,
    smtps: true,
    starttls: true,
    oauth2: false,
    html: true,
    attachments: true,
  };

  async connect(uri: string): Promise<SMTPSession> {
    const url = new URL(uri);
    await mySmtpLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 587,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'smtps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      secure: url.protocol === 'smtps:',
    };
  }

  async request(session: SMTPSession, context: RequestContext): Promise<Response> {
    const message = context.body as EmailMessage;

    try {
      const result = await mySmtpLibrary.send(message);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {
          accepted: result.accepted,
          rejected: result.rejected,
          messageId: result.messageId,
          response: result.response,
        },
        ok: true,
      };
    } catch (error) {
      return {
        status: 500,
        statusText: 'Error',
        headers: {},
        data: { error: error.message },
        ok: false,
      };
    }
  }

  disconnect(session: SMTPSession): void {
    mySmtpLibrary.close();
  }
}

// Utiliser votre connecteur
const { transport } = smtp('smtp://server.com', new MySMTPConnector());
```

### Interface SMTPConnector

```typescript
interface SMTPConnector {
  /** Capacités supportées */
  readonly capabilities: SMTPCapabilities;

  /** Établir la connexion et retourner la session */
  connect(uri: string): Promise<SMTPSession>;

  /** Envoyer un email */
  request(session: SMTPSession, context: RequestContext): Promise<Response>;

  /** Vérifier la connexion (optionnel) */
  verify?(session: SMTPSession): Promise<boolean>;

  /** Nettoyer les ressources */
  disconnect(session: SMTPSession): Promise<void> | void;
}

interface SMTPSession {
  connected: boolean;
  host: string;
  user: string;
  secure: boolean;
}

interface SMTPCapabilities {
  readonly smtp: boolean;
  readonly smtps: boolean;
  readonly starttls: boolean;
  readonly oauth2: boolean;
  readonly html: boolean;
  readonly attachments: boolean;
}
```

### Pourquoi BYOC ?

- **Tests** : Utiliser des connecteurs mock pour les tests unitaires sans vrais serveurs SMTP
- **Entreprise** : Intégrer avec des bibliothèques mail internes qui gèrent auth/logging
- **Services Email Transactionnels** : Créer des connecteurs pour SendGrid, Mailgun, etc.
- **Tree-shaking** : Éviter de bundler `nodemailer` si vous utilisez un connecteur personnalisé

## Cycle de Vie des Connexions

- Le transport se connecte paresseusement au premier envoi et réutilise la session
- Les connexions sont poolées avec l'option `pool: true`
- Utilisez `connector.disconnect()` dans les hooks de shutdown

## Gestion des Erreurs & Retry

```typescript
import { client, retry, backoff } from '@unireq/core';
import { smtp } from '@unireq/smtp';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientMail = client(
  smtp('smtp://smtp.gmail.com:587').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Les erreurs réseau/auth retournent `{ ok: false, status: 500, data: { error: message } }`
- Composez avec `retry`, circuit breakers, ou `either` de `@unireq/core`
- Soyez attentif aux limites de taux des fournisseurs email

## Exemple Gmail Complet

```typescript
import { preset } from '@unireq/presets';

// Utilisation du mot de passe d'application
const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;

// Créer le client SMTP
const mail = preset.smtp
  .uri(`smtp://${encodeURIComponent(GMAIL_USER)}:${encodeURIComponent(GMAIL_APP_PASSWORD)}@smtp.gmail.com:587`)
  .retry
  .build();

// Créer le client IMAP pour la lecture
const inbox = preset.imap
  .uri(`imaps://${encodeURIComponent(GMAIL_USER)}:${encodeURIComponent(GMAIL_APP_PASSWORD)}@imap.gmail.com:993`)
  .retry
  .build();

// Lire les 10 derniers emails
const messages = await inbox.fetch('INBOX', '1:10');
console.log(`Trouvé ${messages.length} emails`);

// Envoyer un email
const result = await mail.send({
  from: GMAIL_USER,
  to: 'destinataire@example.com',
  subject: 'Bonjour de unireq !',
  text: 'Cet email a été envoyé avec @unireq/smtp',
  html: '<h1>Bonjour de unireq !</h1><p>Cet email a été envoyé avec @unireq/smtp</p>',
});

console.log(`Envoyé : ${result.messageId}`);
```

---

<p align="center">
  <a href="#/fr/packages/imap">&larr; IMAP</a> &middot; <a href="#/fr/packages/xml">XML &rarr;</a>
</p>
