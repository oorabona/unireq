# @unireq/otel

Instrumentation OpenTelemetry pour les clients HTTP unireq. Fournit un tracing automatique avec propagation du contexte de trace W3C suivant les conventions sémantiques OpenTelemetry.

## Installation

```bash
pnpm add @unireq/otel

# Dépendances peer
pnpm add @opentelemetry/api @opentelemetry/semantic-conventions
```

## Aperçu des Exports

| Catégorie | Symboles | Objectif |
| --- | --- | --- |
| Policy | `otel(options)` | Crée une policy de tracing qui enveloppe les requêtes HTTP dans des spans. |
| Types | `OtelOptions`, `SpanNameFormatter` | Interfaces de configuration et personnalisation. |

## Démarrage Rapide

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';
import { trace } from '@opentelemetry/api';

// Obtenir un tracer depuis votre configuration OpenTelemetry
const tracer = trace.getTracer('my-service', '1.0.0');

// Créer un client tracé
const api = client(
  http('https://api.example.com'),
  otel({ tracer }),
  parse.json()
);

// Toutes les requêtes créeront maintenant des spans
const response = await api.get('/users');
```

## Options de Configuration

```typescript
interface OtelOptions {
  /** Instance de tracer OpenTelemetry (obligatoire) */
  readonly tracer: Tracer;

  /** Formateur de nom de span personnalisé (défaut: `HTTP ${method}`) */
  readonly spanNameFormatter?: (ctx: RequestContext) => string;

  /** Enregistrer la taille du corps de requête dans les attributs du span (défaut: false) */
  readonly recordRequestBodySize?: boolean;

  /** Enregistrer la taille du corps de réponse dans les attributs du span (défaut: false) */
  readonly recordResponseBodySize?: boolean;

  /** Attributs personnalisés à ajouter à chaque span */
  readonly customAttributes?: Record<string, string | number | boolean>;

  /** Propager le contexte de trace aux services en aval (défaut: true) */
  readonly propagateContext?: boolean;
}
```

## Attributs du Span

La policy définit les attributs suivants selon les conventions sémantiques OpenTelemetry :

| Attribut | Description |
| --- | --- |
| `http.request.method` | Méthode HTTP (GET, POST, etc.) |
| `url.full` | URL complète de la requête |
| `server.address` | Nom d'hôte du serveur |
| `server.port` | Port du serveur |
| `http.response.status_code` | Code de statut de la réponse |
| `http.request.body.size` | Taille du corps de requête (si activé) |
| `http.response.body.size` | Taille du corps de réponse (si activé) |
| `error.type` | Type d'erreur en cas d'échec |

## Noms de Span Personnalisés

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    spanNameFormatter: (ctx) => {
      const path = new URL(ctx.url).pathname;
      return `${ctx.method} ${path}`;
    },
  }),
  parse.json()
);

// Les spans seront nommés comme "GET /users/123"
```

## Ajout d'Attributs Personnalisés

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    customAttributes: {
      'service.name': 'user-service',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    },
  }),
  parse.json()
);
```

## Enregistrement de la Taille du Corps

Pour le débogage ou l'analyse des performances, activez l'enregistrement de la taille du corps :

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    recordRequestBodySize: true,
    recordResponseBodySize: true,
  }),
  parse.json()
);
```

> **Note** : Le calcul de la taille du corps peut avoir des implications sur les performances pour les gros payloads.

## Propagation du Contexte de Trace

Par défaut, les en-têtes W3C Trace Context sont injectés dans les requêtes sortantes :

- `traceparent` - ID de trace et ID de span
- `tracestate` - Données de trace spécifiques au vendeur

Cela permet le tracing distribué entre les services :

```typescript
// Service A
const api = client(
  http('https://service-b.internal'),
  otel({ tracer, propagateContext: true }), // défaut
  parse.json()
);

// La requête vers le Service B inclura les en-têtes de trace
// Le Service B peut continuer la trace
```

Pour désactiver la propagation :

```typescript
const api = client(
  http('https://external-api.com'),
  otel({ tracer, propagateContext: false }),
  parse.json()
);
```

## Exemple Complet avec Configuration du SDK

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';

// Configuration du SDK OpenTelemetry
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';

// Initialiser le SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'my-service',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
});

sdk.start();

// Obtenir le tracer après le démarrage du SDK
const tracer = trace.getTracer('my-service', '1.0.0');

// Créer le client instrumenté
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    spanNameFormatter: (ctx) => `HTTP ${ctx.method} ${new URL(ctx.url).pathname}`,
    customAttributes: {
      'service.version': '1.0.0',
    },
  }),
  parse.json()
);

// Toutes les requêtes créent des spans exportés vers votre collecteur
const users = await api.get('/users');

// Arrêt gracieux
process.on('SIGTERM', async () => {
  await sdk.shutdown();
});
```

## Gestion des Erreurs

Les erreurs sont automatiquement enregistrées dans les spans :

- Le statut du span est défini sur `ERROR`
- L'exception est enregistrée avec `span.recordException()`
- L'attribut `error.type` est défini sur le nom de l'erreur

```typescript
try {
  await api.get('/failing-endpoint');
} catch (error) {
  // Le span a déjà les informations d'erreur enregistrées
}
```

## Codes de Statut HTTP

- **2xx-3xx** : Statut du span = `OK`
- **4xx-5xx** : Statut du span = `ERROR`, `error.type` = code de statut

## Intégration avec les Autres Policies

Placez `otel()` tôt dans la chaîne de policies pour capturer le cycle de vie complet de la requête :

```typescript
const api = client(
  http('https://api.example.com'),
  otel({ tracer }),           // Trace tout ce qui suit
  retry(...),                 // Les retries sont inclus dans le span
  timeout(5000),              // Le timeout est inclus dans le span
  parse.json()
);
```

## Chargement Paresseux

L'API OpenTelemetry est importée paresseusement à la première requête. Si `@opentelemetry/api` n'est pas disponible, la policy passe simplement à travers sans tracer.

---

<p align="center">
  <a href="#/fr/packages/presets">&larr; Presets</a> &middot; <a href="#/fr/packages/config">Config &rarr;</a>
</p>
