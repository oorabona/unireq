# Authentification OAuth

Cet exemple montre comment gérer l'authentification OAuth 2.0 avec rafraîchissement automatique du token.

## Code Unireq

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

// Fournisseur de token simulé
const tokenSupplier = async () => {
  // Dans une vraie app, appelez votre serveur d'auth ici
  return 'mon-access-token';
};

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier,
    // Rafraîchit automatiquement si le serveur renvoie 401
    autoRefresh: true
  }),
  parse.json()
);

await api.get('/protected-resource');
```

## Comparaison avec Axios

### Axios

Avec Axios, vous devez utiliser des intercepteurs complexes pour gérer le rafraîchissement de token.

```javascript
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const token = await refreshToken(); // Logique complexe ici
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      return axios(originalRequest);
    }
    return Promise.reject(error);
  }
);
```

### Différences

1.  **Simplicité** : Unireq fournit `oauthBearer` prêt à l'emploi. Pas besoin d'écrire une logique de retry complexe dans des intercepteurs.
2.  **Single-Flight** : Unireq gère automatiquement les requêtes concurrentes pendant le rafraîchissement (une seule requête de refresh est envoyée, les autres attendent). Avec Axios, vous devez implémenter un système de file d'attente manuellement pour éviter de spammer votre serveur d'auth.

---

<p align="center">
  <a href="#/fr/examples/basic">← Basique</a> · <a href="#/fr/examples/uploads">Uploads →</a>
</p>