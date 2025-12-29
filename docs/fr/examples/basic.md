# Requête HTTP Basique

Cet exemple montre comment effectuer des requêtes HTTP de base (GET, POST) avec Unireq.

## Code Unireq

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Création du client avec transport HTTP et parseur JSON
const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json()
);

// Requête GET typée
interface Post {
  id: number;
  title: string;
}

const response = await api.get<Post>('/posts/1');

console.log(`Status: ${response.status}`);
console.log(`Titre: ${response.data.title}`);
```

## Comparaison avec Axios

### Axios

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com'
});

try {
  const response = await api.get('/posts/1');
  console.log(response.data);
} catch (error) {
  console.error(error);
}
```

### Différences

1.  **Gestion d'Erreur** : Axios lève une exception pour les erreurs non-2xx. Unireq ne le fait pas par défaut (vous devez vérifier `response.ok`).
2.  **Parsing** : Axios parse le JSON automatiquement par défaut. Unireq est explicite : vous ajoutez `parse.json()` si vous voulez du JSON. Cela permet de supporter d'autres formats (XML, ProtoBuf, etc.) sans bloat.
3.  **Typage** : Unireq est conçu pour TypeScript first.

---

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/examples/auth">Authentification →</a>
</p>