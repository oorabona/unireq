# 📚 Unireq Examples

Ce dossier contient des exemples pratiques montrant comment utiliser @unireq avec le nouveau système de body/parse composable.

## 🚀 Lancer les exemples

```bash
# Installer les dépendances d'abord
pnpm install

# Build les packages
pnpm build

# Lancer TOUS les exemples en séquence (20 exemples)
pnpm examples:all

# Lancer plusieurs exemples spécifiques
pnpm examples:run http oauth retry graphql-query

# Lancer un seul exemple
pnpm example:http              # HTTP basic
pnpm example:oauth             # OAuth avec refresh automatique
pnpm example:retry             # Retry avec exponential backoff
pnpm example:multipart         # Upload multipart composable
pnpm example:bulk-upload       # Upload de documents multiples
pnpm example:ecommerce         # Création de produit e-commerce
pnpm example:ci-artifacts      # Upload d'artefacts CI/CD
pnpm example:email             # Email avec pièces jointes
pnpm example:form              # Soumission de formulaires
pnpm example:graphql-query     # GraphQL queries avec variables et fragments
pnpm example:graphql-mutation  # GraphQL mutations
pnpm example:streaming-upload  # Upload en streaming (large files)
pnpm example:streaming-download # Download en streaming avec progress
pnpm example:sse               # Server-Sent Events (temps réel)
pnpm example:interceptors-logging # Intercepteurs pour logging
pnpm example:interceptors-metrics # Intercepteurs pour métriques
pnpm example:interceptors-cache    # Intercepteurs pour cache HTTP
pnpm example:conditional-etag      # Requêtes conditionnelles ETag
pnpm example:conditional-lastmodified # Requêtes conditionnelles Last-Modified
pnpm example:conditional-combined  # ETag + Last-Modified combinés

# Ou lancer n'importe quel fichier .ts
pnpm example examples/custom-example.ts
```

## 📖 Exemples disponibles

### `http-basic.ts`
Requête HTTP de base avec le nouveau système body/parse.
- ✅ Configuration client simple
- ✅ GET request typé avec `parse.json()`
- ✅ POST avec `body.json()`
- ✅ Base URL

### `oauth-refresh.ts`
Authentification OAuth avec refresh automatique de token.
- ✅ Token supplier personnalisé
- ✅ Refresh automatique sur 401
- ✅ Single-flight refresh (évite les refreshes concurrents)

### `retry-backoff.ts`
Retry automatique avec exponential backoff et jitter.
- ✅ Configuration retry flexible
- ✅ Exponential backoff avec cap
- ✅ Jitter pour éviter thundering herd
- ✅ Méthodes HTTP configurables

### `multipart-upload.ts`
Upload de fichiers en multipart/form-data avec composition.
- ✅ Composition avec `body.multipart()`
- ✅ Parties texte (`body.text()`), binaire (`body.binary()`)
- ✅ Validation MIME type
- ✅ Limite de taille fichier
- ✅ Sanitization des noms de fichiers
- ✅ Réutilisation du client pour plusieurs uploads

### `bulk-document-upload.ts`
Upload de plusieurs documents de formats différents.
- ✅ JSON metadata avec `body.json()`
- ✅ XML avec `body.text()`
- ✅ PDF binaire avec `body.binary()`
- ✅ Upload composable en une seule requête

### `ecommerce-product-create.ts`
Création de produit e-commerce avec images et spécifications.
- ✅ Données produit JSON
- ✅ Images multiples
- ✅ Spécifications techniques XML
- ✅ Composition body.multipart() avancée

### `ci-artifacts-upload.ts`
Upload d'artefacts CI/CD (logs, rapports, binaires).
- ✅ 5 types d'artefacts différents
- ✅ Logs texte, rapports JSON, couverture XML
- ✅ Binaires compilés
- ✅ Archives compressées

### `email-with-attachments.ts`
Envoi d'email avec pièces jointes multiples.
- ✅ Email JSON (to, subject, body)
- ✅ HTML alternatif
- ✅ PDF et images en pièces jointes
- ✅ Composition élégante

### `form-submission.ts`
Soumission de formulaires HTML (application/x-www-form-urlencoded).
- ✅ `body.form()` pour formulaires classiques
- ✅ Login, recherche, contact
- ✅ Gestion des caractères spéciaux
- ✅ Encodage URL automatique

### `graphql-query.ts`
Requêtes GraphQL avec variables et fragments (API réelle: Countries).
- ✅ Queries composables avec `query()`
- ✅ Variables typées avec `variable()`
- ✅ Fragments réutilisables avec `fragment()`
- ✅ Intégration avec `graphql()` body serializer
- ✅ Démonstration avec Countries API (250 pays)
- ✅ Queries avec variables et fragments

### `graphql-mutation.ts`
Mutations GraphQL pour créer/modifier/supprimer (API réelle: GraphQLZero).
- ✅ Mutations avec `mutation()`
- ✅ Input types et variables
- ✅ Create, Update, Delete operations
- ✅ Multiple mutations en séquence
- ✅ Gestion des erreurs GraphQL
- ✅ Démonstration avec API de test gratuite

### `streaming-upload.ts`
Upload en streaming de fichiers volumineux.
- ✅ `body.stream()` pour uploads ReadableStream
- ✅ Content-Length pour progress tracking
- ✅ Low memory footprint
- ✅ Support vidéos, backups, logs

### `streaming-download.ts`
Download en streaming avec traitement par chunks.
- ✅ `parse.stream()` pour downloads ReadableStream
- ✅ Progress tracking en temps réel
- ✅ Traitement chunk par chunk
- ✅ Économie mémoire pour gros fichiers

### `sse-events.ts`
Server-Sent Events pour mises à jour temps réel.
- ✅ `parse.sse()` pour événements serveur
- ✅ Parsing automatique SSE protocol
- ✅ Support multi-line data
- ✅ Event types, IDs, retry

### `interceptors-logging.ts`
Intercepteurs pour logging de requêtes/réponses.
- ✅ `interceptRequest()` pour logger les requêtes
- ✅ `interceptResponse()` pour logger les réponses
- ✅ Logging avec timing/durée
- ✅ Logs structurés JSON

### `interceptors-metrics.ts`
Intercepteurs pour collecte de métriques.
- ✅ Compteur de requêtes par méthode/status
- ✅ Tracking temps de réponse (p50, p95, p99)
- ✅ Tracking bandwidth sent/received
- ✅ Dashboard temps réel

### `interceptors-cache.ts`
Intercepteurs pour cache HTTP.
- ✅ Cache in-memory simple avec TTL
- ✅ Support ETag et requêtes conditionnelles
- ✅ Cache-Control header compliance
- ✅ LRU cache avec limite de taille

### `conditional-etag.ts`
Requêtes conditionnelles avec ETag.
- ✅ `etag()` policy pour cache basé sur ETag
- ✅ Support If-None-Match
- ✅ Gestion 304 Not Modified
- ✅ Callbacks pour monitoring (onCacheHit, onRevalidated)

### `conditional-lastmodified.ts`
Requêtes conditionnelles avec Last-Modified.
- ✅ `lastModified()` policy pour cache basé sur timestamp
- ✅ Support If-Modified-Since
- ✅ Gestion 304 Not Modified
- ✅ Monitoring des performances cache

### `conditional-combined.ts`
Combinaison automatique ETag + Last-Modified.
- ✅ `conditional()` policy pour sélection automatique
- ✅ Préférence ETag, fallback Last-Modified
- ✅ Mesure de performance cache
- ✅ Best practices production

## 🎯 Créer vos propres exemples

Créez un fichier `.ts` dans ce dossier et lancez-le avec :

```bash
pnpm example examples/votre-exemple.ts
```

Les packages @unireq sont disponibles directement :

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

// Créer un client
const api = client(http('https://api.example.com'));

// Utiliser le système composable body/parse
const response = await api.post(
  '/upload',
  body.multipart(
    { name: 'data', part: body.json({ title: 'Example' }) },
    { name: 'file', part: body.binary(buffer, 'image/png'), filename: 'image.png' }
  ),
  parse.json()
);
```

## 📚 Système Body/Parse

### Body serializers (`body.*`)

- **`body.json(data)`** - Sérialise en JSON (Content-Type: application/json)
- **`body.text(string)`** - Texte brut (Content-Type: text/plain)
- **`body.form(object)`** - Formulaire URL-encoded (Content-Type: application/x-www-form-urlencoded)
- **`body.binary(data, contentType)`** - Données binaires (Blob/ArrayBuffer)
- **`body.multipart(...parts, options?)`** - Multipart composable avec validation

### Response parsers (`parse.*`)

- **`parse.json()`** - Parse JSON et set Accept: application/json
- **`parse.text()`** - Parse texte et set Accept: text/plain
- **`parse.binary()`** - Retourne ArrayBuffer et set Accept: application/octet-stream
- **`parse.raw()`** - Pas de parsing, set Accept: */*
