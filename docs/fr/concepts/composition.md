# Modèle de Composition

## Middleware en Oignon

Unireq utilise un modèle de middleware en "oignon" via `compose(...policies)`. Les requêtes traversent les policies de l'extérieur vers l'intérieur, atteignent le transport, puis les réponses reviennent de l'intérieur vers l'extérieur.

```ts
const policy = compose(
  policyA, // Pré-appel (couche externe)
  policyB, // Pré-appel (couche intermédiaire)
  policyC  // Pré-appel (couche interne)
);
// Exécution : A → B → C → transport → C → B → A
```

## Sens du flux & ordre

- Les policies s'exécutent **dans l'ordre où elles sont passées** avant le transport, puis se déroulent en sens inverse sur le chemin retour.
- Les policies globales définies dans `client(transport, ...policies)` enveloppent chaque requête. Les policies ponctuelles passées à `client.request(url, init, ...once)` sont ajoutées à la fin et se retrouvent donc au plus proche du transport.
- Comme la chaîne est déterministe, l'ordre relatif décide quelle couche voit la requête/réponse en premier.

| Objectif | Placement conseillé | Pourquoi |
| --- | --- | --- |
| Observabilité (logs, traces, métriques) | Tout à l'extérieur | Capture la latence totale et chaque tentative de retry. |
| Résilience (`retry`, circuit breaker) | Juste après l'observabilité | Doit voir les erreurs avant qu'elles ne soient traitées par les couches basses, mais envelopper l'auth/parsing. |
| Authentification (`oauthBearer`, `cookies`, signature) | Proche du transport | S'exécute à chaque retry et intercepte les réponses (401, 419) avant la couche résilience. |
| Sérialisation (`body.*`, `multipart`, validateurs requête) | Interne | Prépare le payload final pour chaque tentative. |
| Parsing / désérialisation (`parse.*`, validateurs réponse) | Dernière couche avant le transport | Accède à la réponse brute avant toute autre transformation. |

### Exemple retry vs OAuth

```ts
import { client, retry } from '@unireq/core';
import { http, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [rateLimitDelay({ maxWait: 60_000 })]), // externe
  oauthBearer({ tokenSupplier: fetchToken }),                         // interne
  parse.json(),                                                       // au plus proche du transport
);
```

Avec `retry` placé à l'extérieur, `oauthBearer` voit en premier les réponses `401 Unauthorized`. Il peut rafraîchir le token puis rejouer l'appel sans que la couche retry n'intervienne. Ce n'est que si la tentative rafraîchie échoue encore (timeout, 5xx, refresh impossible) que `retry` prend la main. En inversant l'ordre, le retry pourrait rejouer plusieurs fois avec un token périmé avant même que la couche OAuth ait la possibilité de le renouveler.

Les mêmes principes s'appliquent ailleurs :

- Placez la signature de requête ou le mTLS près du transport pour que chaque replay reste authentifié.
- Gardez les parseurs en dernier afin qu'ils voient toujours la réponse finale, même après un retry.
- Si vous devez ajouter des en-têtes après OAuth (par exemple `traceparent`), mettez cette policy *à l'extérieur* pour que les tentatives rafraîchies conservent l'en-tête.

## Branchement Conditionnel

Vous pouvez utiliser `either(pred, then, else)` pour créer des branches conditionnelles dans votre chaîne de policies. C'est utile pour la négociation de contenu ou pour gérer différents scénarios basés sur le contexte de la requête.

```ts
import { either } from '@unireq/core';
import { parse } from '@unireq/http';
import { parse as xmlParse } from '@unireq/xml';

either(
  (ctx) => ctx.headers.accept?.includes('json'),
  parse.json(),  // Si vrai : parse comme JSON
  xmlParse()     // Si faux : parse comme XML
);
```

---

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/concepts/body-parsing">Corps & Parsing →</a>
</p>