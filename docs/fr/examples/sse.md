# Server-Sent Events (SSE)

Cet exemple montre comment consommer des flux d'événements serveur (SSE) en temps réel.

## Code Unireq

```typescript
import { client } from '@unireq/core';
import { http, parse, type SSEEvent } from '@unireq/http';

const api = client(http('https://postman-echo.com'));

// Utilisation de parse.sse() pour obtenir un AsyncIterable<SSEEvent>
const response = await api.get('/server-events/5', parse.sse());

// Itération asynchrone sur les événements
for await (const event of response.data) {
  console.log(`Event Type: ${event.event}`);
  console.log(`Data: ${event.data}`);
  console.log(`ID: ${event.id}`);
}
```

## Comparaison avec Axios

### Axios

Axios ne supporte pas SSE nativement. Vous devez utiliser l'API native `EventSource` du navigateur ou une librairie tierce.

```javascript
// Navigateur uniquement
const eventSource = new EventSource('https://postman-echo.com/server-events/5');

eventSource.onmessage = (event) => {
  console.log(event.data);
};

eventSource.onerror = (error) => {
  console.error('SSE failed:', error);
  eventSource.close();
};
```

### Différences

1.  **Support Node.js** : `EventSource` n'est pas disponible nativement dans Node.js (avant les versions très récentes ou sans polyfill). Unireq fournit une implémentation SSE qui fonctionne partout (Node.js et Navigateur) via le même code.
2.  **Intégration** : Avec Unireq, SSE est juste un autre format de réponse (`parse.sse()`). Vous bénéficiez de toute la chaîne de policies (auth, headers, logging, etc.) pour la requête initiale de connexion. Avec `EventSource`, il est souvent difficile d'ajouter des headers personnalisés (comme `Authorization`).

---

<p align="center">
  <a href="#/fr/examples/validation">← Validation</a> · <a href="#/fr/README">Accueil →</a>
</p>