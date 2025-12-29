# Intercepteurs & Logging

Cet exemple montre comment utiliser des intercepteurs pour logger les requêtes et les réponses.

## Code Unireq

```typescript
import { client } from '@unireq/core';
import { http, interceptRequest, interceptResponse, parse } from '@unireq/http';

// Intercepteur de requête
const logRequest = (ctx) => {
  console.log(`→ ${ctx.method} ${ctx.url}`);
  const startTime = Date.now();
  // On peut attacher des données au contexte pour les récupérer dans la réponse
  return { ...ctx, startTime };
};

// Intercepteur de réponse
const logResponse = (response, ctx) => {
  const duration = Date.now() - (ctx.startTime || 0);
  console.log(`← ${response.status} (${duration}ms)`);
  return response;
};

const api = client(
  http('https://api.example.com'),
  interceptRequest(logRequest),
  interceptResponse(logResponse),
  parse.json()
);

await api.get('/users');
```

## Comparaison avec Axios

### Axios

```javascript
axios.interceptors.request.use(config => {
  config.metadata = { startTime: new Date() };
  console.log(`→ ${config.method.toUpperCase()} ${config.url}`);
  return config;
});

axios.interceptors.response.use(response => {
  const duration = new Date() - response.config.metadata.startTime;
  console.log(`← ${response.status} (${duration}ms)`);
  return response;
});
```

### Différences

1.  **Immutabilité** : Dans Unireq, les intercepteurs retournent un *nouveau* contexte ou une *nouvelle* réponse. Dans Axios, vous mutez souvent l'objet `config`.
2.  **Contexte** : Unireq passe un objet `ctx` qui contient tout ce qui est nécessaire pour la requête. Vous pouvez l'étendre de manière type-safe.
3.  **Composition** : Les intercepteurs Unireq sont juste des policies. Vous pouvez les composer, les réutiliser et les tester facilement.

---

<p align="center">
  <a href="#/fr/examples/graphql">← GraphQL</a> · <a href="#/fr/examples/streaming">Streaming →</a>
</p>