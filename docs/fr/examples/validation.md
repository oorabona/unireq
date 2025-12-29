# Validation de Données

Cet exemple montre comment valider les réponses API en utilisant des schémas (Zod, Valibot) via des adaptateurs.

## Code Unireq

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { z } from 'zod';

// 1. Définir un schéma Zod
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// 2. Créer un adaptateur (ou importer depuis une lib)
const zodAdapter = () => (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
};

// 3. Utiliser la policy validate()
const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserSchema, zodAdapter())
);

try {
  // response.data est maintenant typé comme z.infer<typeof UserSchema>
  const response = await api.get('/users/1');
  console.log(response.data.email);
} catch (error) {
  console.error('Validation failed:', error);
}
```

## Comparaison avec Axios

### Axios

Axios ne valide pas les données. Vous devez le faire manuellement après la requête.

```javascript
const response = await axios.get('https://jsonplaceholder.typicode.com/users/1');

try {
  const user = UserSchema.parse(response.data);
  console.log(user.email);
} catch (error) {
  console.error('Validation failed:', error);
}
```

### Différences

1.  **Intégration** : Avec Unireq, la validation fait partie du pipeline de la requête. Si la validation échoue, la requête est considérée comme échouée (et peut être interceptée ou loggée comme telle).
2.  **Typage Automatique** : La policy `validate` infère automatiquement le type de retour de `api.get()` basé sur le schéma. Pas besoin de passer des génériques manuellement.
3.  **Agnostique** : Unireq utilise un pattern d'adaptateur, donc vous pouvez utiliser Zod, Valibot, ArkType, ou n'importe quelle autre librairie de validation.

---

<p align="center">
  <a href="#/fr/examples/retry">← Retry</a> · <a href="#/fr/examples/sse">SSE →</a>
</p>