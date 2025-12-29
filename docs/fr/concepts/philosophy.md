# Philosophie & Comparaison

Unireq est conçu avec une philosophie spécifique : **Composition plutôt que Configuration**.

## Le problème du "Tout-en-un" (Kitchen Sink)

Les clients HTTP traditionnels comme Axios ou l'API native `fetch` souffrent souvent du problème du "tout-en-un". Ils essaient de tout faire via un objet de configuration massif.

### La méthode Axios (Orienté Objet / Config)

```javascript
// Axios: Everything is a config option
const client = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 1000,
  headers: { 'X-Custom': 'foobar' },
  validateStatus: (status) => status < 500, // Config callback
  transformResponse: [ ... ], // Array of hooks
});
```

Cela fonctionne bien pour les cas simples, mais devient difficile à étendre. Ajouter une nouvelle fonctionnalité (comme la rotation OAuth ou une logique de retry complexe) nécessite souvent d'envelopper le client ou d'utiliser des "intercepteurs" qui mutent l'état global.

## La méthode Unireq (Fonctionnel / Composition)

Unireq adopte une approche différente. Un client est juste un **transport** (la chose qui envoie les octets) enveloppé dans des couches de **policies** (fonctions qui modifient la requête ou la réponse).

```typescript
import { client } from '@unireq/core';
import { http, headers, timeout } from '@unireq/http';

// Unireq: Everything is a function
const api = client(
  http('https://api.example.com'), // 1. Transport
  headers({ 'X-Custom': 'foobar' }), // 2. Policy
  timeout(1000)                      // 3. Policy
);
```

### Différences Clés

| Fonctionnalité | Axios / Traditionnel | Unireq |
|---------|---------------------|--------|
| **Configuration** | Objet d'options géant | Fonctions composables (Policies) |
| **Extensibilité** | Intercepteurs / Hooks | Écrivez votre propre fonction Policy |
| **État** | Souvent mutable (pile d'intercepteurs) | Chaîne de policies immuable |
| **Gestion d'Erreur** | Lève une exception sur non-2xx par défaut | **Ne lève pas d'exception** (renvoie `ok: false`) |
| **Taille du Bundle** | Monolithique (toutes fonctionnalités incluses) | Tree-shakeable (importez seulement ce que vous utilisez) |

## Pourquoi "Pas d'Exception" par défaut ?

Unireq traite les réponses HTTP comme des *valeurs*, pas des exceptions. Un 404 Not Found est une réponse HTTP valide, pas une exception d'exécution comme une panne réseau.

- **Erreur Réseau (DNS, Hors ligne) :** Lève `NetworkError`.
- **Timeout :** Lève `TimeoutError`.
- **Réponses 4xx/5xx :** Renvoie l'objet réponse.

Cela vous force à gérer la réponse explicitement, ce qui conduit à un code plus robuste.

```typescript
const response = await api.get('/users/123');

if (!response.ok) {
  // Handle 404, 500, etc. gracefully
  if (response.status === 404) return null;
  // Or throw manually if you really want to
  throw new Error(`API Error: ${response.status}`);
}

// TypeScript knows response.data is safe here if you use a parser
console.log(response.data);
```

## Le Modèle en Oignon

Unireq utilise un modèle middleware en "oignon". Les requêtes entrent *dans* les couches, et les réponses sortent *par* les couches.

1. **Début de la requête**
2. `retry` policy (commence le suivi)
3. `headers` policy (ajoute les en-têtes)
4. `http` transport (envoie la requête)
5. **Réponse reçue**
6. `headers` policy (voit la réponse, ne fait rien)
7. `retry` policy (vérifie le statut, réessaie peut-être)
8. **Résultat renvoyé**

Cela rend facile le raisonnement sur des comportements complexes comme "réessayer cette requête, mais rafraîchir le token auth si elle échoue avec 401".

---

<p align="center">
  <a href="#/fr/guide/quick-start">← Démarrage Rapide</a> · <a href="#/fr/concepts/composition">Composition →</a>
</p>