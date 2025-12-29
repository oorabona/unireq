# Uploads Multipart

Cet exemple montre comment uploader des fichiers en utilisant `multipart/form-data`.

## Code Unireq

```typescript
import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

const api = client(http('https://api.example.com'));

await api.post(
  '/upload',
  body.multipart(
    // Fichier texte
    {
      name: 'file',
      part: body.text('Contenu du fichier'),
      filename: 'example.txt',
    },
    // Fichier binaire
    {
      name: 'image',
      part: body.binary(new Uint8Array([137, 80, 78, 71]).buffer, 'image/png'),
      filename: 'avatar.png',
    },
    // Champ simple
    {
      name: 'title',
      part: body.text('Mon Upload'),
    },
    // Options de validation
    {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['text/*', 'image/*'],
      sanitizeFilenames: true,
    }
  ),
  parse.json()
);
```

## Comparaison avec Axios

### Axios

Avec Axios, vous devez souvent utiliser `FormData` (navigateur) ou `form-data` (Node.js) manuellement.

```javascript
const FormData = require('form-data');
const form = new FormData();

form.append('file', fs.createReadStream('example.txt'));
form.append('title', 'Mon Upload');

await axios.post('https://api.example.com/upload', form, {
  headers: form.getHeaders() // Nécessaire en Node.js
});
```

### Différences

1.  **Abstraction Unifiée** : Unireq fournit une API unifiée `body.multipart` qui fonctionne partout. Pas besoin de se soucier de `FormData` vs `form-data` ou de définir manuellement les headers de boundary.
2.  **Validation Intégrée** : Unireq permet de valider la taille et le type MIME des fichiers *avant* l'envoi, directement dans la définition de la requête.
3.  **Composition** : Chaque partie du multipart est elle-même définie par un helper `body.*`, ce qui est très flexible.

---

<p align="center">
  <a href="#/fr/examples/auth">← Auth</a> · <a href="#/fr/examples/graphql">GraphQL →</a>
</p>