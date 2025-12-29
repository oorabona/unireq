# 🛠️ Scripts Utilitaires

Ce dossier contient des scripts shell pour faciliter le développement et les tests.

## 📦 Scripts disponibles

### `run-all-examples.sh`

Lance tous les exemples en séquence. **Détection automatique** des exemples depuis `package.json`.

**Usage:**
```bash
pnpm examples:all
# ou directement
bash scripts/run-all-examples.sh
```

**Fonctionnement:**
- 🚀 Démarre automatiquement le mock server HTTP local (localhost:3001)
- 📦 Scanne automatiquement tous les scripts `example:*` dans `package.json`
- ✅ Exclut le script générique `example` (utilisé pour lancer n'importe quel fichier)
- 📊 Affiche le nombre d'exemples trouvés avant de commencer
- ▶️ Lance chaque exemple en séquence avec compteur visuel
- 🛑 Arrête automatiquement le mock server à la fin

**Avantages:**
- ✅ Pas besoin de maintenir une liste manuelle
- ✅ Toujours à jour automatiquement quand on ajoute un exemple
- ✅ Mock server géré automatiquement
- ✅ Évite les oublis

**Durée estimée:** ~1-2 minutes (avec mock server local, plus besoin de latence réseau)

---

### `run-examples.sh`

Lance un sous-ensemble spécifique d'exemples.

**Usage:**
```bash
pnpm examples:run <example1> [example2] [...]
# ou directement
bash scripts/run-examples.sh <example1> [example2] [...]
```

**Exemples:**
```bash
# Tester uniquement GraphQL
pnpm examples:run graphql-query graphql-mutation

# Tester les features HTTP de base
pnpm examples:run http oauth retry

# Tester les interceptors
pnpm examples:run interceptors-logging interceptors-metrics interceptors-cache

# Tester le conditional caching
pnpm examples:run conditional-etag conditional-lastmodified conditional-combined
```

**Noms d'exemples disponibles:**
```
http, oauth, retry, multipart, bulk-upload, ecommerce,
ci-artifacts, email, form, graphql-query, graphql-mutation,
streaming-upload, streaming-download, sse,
interceptors-logging, interceptors-metrics, interceptors-cache,
conditional-etag, conditional-lastmodified, conditional-combined
```

---

## 💡 Utilisation typique

### Développement d'une nouvelle feature
```bash
# Tester les exemples pertinents pour votre feature
pnpm examples:run http retry interceptors-logging
```

### Avant un commit
```bash
# Vérifier que tous les exemples fonctionnent
pnpm examples:all
```

### CI/CD
```bash
# Dans votre pipeline CI
pnpm build
pnpm examples:all
```

---

## 🎯 Sortie du script

Les scripts affichent:
- 📦 Nom de l'exemple en cours d'exécution
- ✅ Confirmation après chaque exemple réussi
- ✨ Message de succès final avec le nombre d'exemples exécutés
- Séparateurs visuels pour faciliter la lecture

**Exemple de sortie:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Running example [1/2]: graphql-query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[output de l'exemple]

✅ Example 'graphql-query' completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ All 2 examples completed successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎭 Mock Server

### `mock-server/`

Serveur HTTP local qui simule les endpoints httpbin.org pour tester les exemples.

**Documentation:** Voir [mock-server/README.md](mock-server/README.md)

**Usage manuel:**
```bash
pnpm mock-server
```

**Endpoints disponibles:**
- `POST /post` - Multipart, form urlencoded, JSON
- `GET /status/:code` - Retourne le status code demandé
- `GET /html` - Retourne du HTML (test parsing errors)

**Note:** Le mock server est automatiquement démarré par `pnpm examples:all`

---

## 🔧 Maintenance

Pour ajouter un nouvel exemple:
1. Créer le fichier `.ts` dans `examples/`
2. Ajouter le script `example:nom` dans `package.json`
3. Si l'exemple utilise httpbin.org, remplacer par `http://localhost:3001`
4. ✨ **C'est tout!** Le script `run-all-examples.sh` détectera automatiquement le nouvel exemple

Pour retirer un exemple:
1. Supprimer le fichier `.ts` de `examples/`
2. Supprimer le script `example:nom` de `package.json`
3. ✨ **C'est tout!** Plus besoin de modifier les scripts de test
