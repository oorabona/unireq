# Téléchargements en Streaming

Cas complet de téléchargements en streaming avec suivi de progression, parallélisation et simulations de pipelines.

## Points clés

- ✅ `parse.stream()` expose un `ReadableStream` standard en Node et navigateur
- ✅ Traitement des chunks à la volée pour stabiliser la consommation mémoire
- ✅ Plusieurs transferts en parallèle sans buffers intermédiaires
- ✅ Simulations de pipelines avant branchement sur le stockage disque

## Exécuter l'exemple

```bash
pnpm example:streaming-download
```

La commande lance `examples/streaming-download.ts` et affiche quatre scénarios (téléchargement réel, transferts parallèles, traitement simulé et sauvegarde).

## Guide pas-à-pas

### Mise en place

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

const api = client(http('https://httpbin.org'));
```

- Chaque appel ajoute `parse.stream()` pour récupérer un `ReadableStream<Uint8Array>` utilisable dans Node comme dans le navigateur.
- Un seul client suffit pour les quatre scénarios.

### Scénario 1 – Téléchargement réel

```typescript
const response = await api.get('/stream-bytes/10240', parse.stream());
const reader = (response.data as ReadableStream<Uint8Array>).getReader();

let bytesReceived = 0;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  bytesReceived += value.length;
  console.log('chunk', value.length, 'octets');
}
```

- `httpbin` envoie 10 KB découpés : la boucle affiche chaque chunk dès sa réception.
- `getReader()` séquence la lecture pour éviter les courses.

### Scénario 2 – Téléchargements parallèles

```typescript
const downloads = await Promise.all([
  api.get('/stream-bytes/1024', parse.stream()),
  api.get('/stream-bytes/5120', parse.stream()),
  api.get('/stream-bytes/10240', parse.stream()),
]);

for (const response of downloads) {
  const reader = (response.data as ReadableStream<Uint8Array>).getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value?.length ?? 0;
  }
  console.log('total téléchargé :', total, 'octets');
}
```

- `Promise.all` montre qu'on peut lancer plusieurs flux sans surcharger la RAM.
- Chaque stream conserve son propre lecteur pour garder l'ordre des chunks.

### Scénario 3 – Traitement simulé

```typescript
const downloadStream = new ReadableStream<Uint8Array>({
  start(controller) {
    const chunkSize = 1024;
    let offset = 0;
    const push = () => {
      if (offset < mockData.length) {
        controller.enqueue(mockData.slice(offset, offset + chunkSize));
        offset += chunkSize;
        setTimeout(push, 50);
      } else {
        controller.close();
      }
    };
    push();
  },
});

const mockNext = async () => ({ status: 200, headers: {}, data: downloadStream, ok: true });
const streamPolicy = parse.stream();
const simulated = await streamPolicy({ url: '/bytes/5120', method: 'GET', headers: {} }, mockNext);
```

- Ce montage évite tout appel réseau et sert pour les tests unitaires ou les démos offline.
- Remplacez `setTimeout` par une source réelle (SSE, file system) pour affiner la simulation.

### Scénario 4 – Suivi + sauvegarde

```typescript
const progressStream = new ReadableStream<Uint8Array>({
  start(controller) {
    const total = 10 * 1024;
    const chunkSize = 1024;
    let sent = 0;
    const interval = setInterval(() => {
      if (sent >= total) {
        clearInterval(interval);
        controller.close();
        return;
      }
      const chunk = new Uint8Array(Math.min(chunkSize, total - sent));
      chunk.fill(42);
      controller.enqueue(chunk);
      sent += chunk.length;
      console.log('progression', ((sent / total) * 100).toFixed(1), '%');
    }, 100);
  },
});

const progressPolicy = parse.stream();
const progressResponse = await progressPolicy(
  { url: '/bytes/10240', method: 'GET', headers: {} },
  async () => ({
    status: 200,
    headers: { 'content-type': 'application/octet-stream', 'content-length': '10240' },
    data: progressStream,
    ok: true,
  }),
);

const reader = (progressResponse.data as ReadableStream<Uint8Array>).getReader();
const chunks: Uint8Array[] = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}
```

- Les chunks sont concaténés (ou streamés vers `fs.createWriteStream`) pour simuler l'écriture disque.
- L'en-tête `content-length` permet un pourcentage fiable pour la barre de progression.

## Exemple complet

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Création du client HTTP
const api = client(http('https://httpbin.org'));

console.log('📥 Exemples de téléchargement en streaming\n');

try {
  // Exemple 1 : téléchargement réel depuis httpbin.org
  console.log('📊 Exemple 1 : téléchargement réel depuis httpbin.org\n');

  console.log('Téléchargement depuis https://httpbin.org/stream-bytes/10240 (10KB)\n');

  const realResponse = await api.get('/stream-bytes/10240', parse.stream());

  console.log('Traitement des chunks dès leur arrivée :\n');

  const reader = (realResponse.data as ReadableStream<Uint8Array>).getReader();
  let bytesReceived = 0;
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunkCount++;
    bytesReceived += value.length;
    console.log(`  Chunk ${chunkCount} : ${value.length} octets (total : ${bytesReceived} octets)`);
  }

  console.log(`\n✅ Téléchargement terminé : ${bytesReceived} octets en ${chunkCount} chunks\n`);

  // Exemple 2 : flux parallèles
  console.log('📊 Exemple 2 : téléchargements multiples\n');

  console.log('Téléchargement de 3 tailles différentes en parallèle :\n');

  const downloads = await Promise.all([
    api.get('/stream-bytes/1024', parse.stream()), // 1KB
    api.get('/stream-bytes/5120', parse.stream()), // 5KB
    api.get('/stream-bytes/10240', parse.stream()), // 10KB
  ]);

  for (let i = 0; i < downloads.length; i++) {
    const reader = (downloads[i]?.data as ReadableStream<Uint8Array>).getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.length || 0;
    }
    console.log(`  Fichier ${i + 1} : ${total} octets téléchargés`);
  }

  console.log('\n✅ Tous les téléchargements sont terminés\n');

  // Exemple 3 : traitement simulé
  console.log('📊 Exemple 3 : traitement chunk par chunk (simulé)\n');

  const mockData = new Uint8Array(1024 * 5); // 5KB
  for (let i = 0; i < mockData.length; i++) {
    mockData[i] = i % 256;
  }

  const downloadStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const chunkSize = 1024;
      let offset = 0;

      const push = () => {
        if (offset < mockData.length) {
          const chunk = mockData.slice(offset, Math.min(offset + chunkSize, mockData.length));
          controller.enqueue(chunk);
          offset += chunkSize;
          setTimeout(push, 50);
        } else {
          controller.close();
        }
      };

      push();
    },
  });

  const mockNext = async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/octet-stream' },
    data: downloadStream,
    ok: true,
  });

  const policy = parse.stream();
  const response = await policy({ url: '/bytes/5120', method: 'GET', headers: {} }, mockNext);

  console.log('Téléchargement simulé :\n');

  const reader3 = (response.data as ReadableStream<Uint8Array>).getReader();
  let receivedBytes = 0;
  let chunks3 = 0;

  while (true) {
    const { done, value } = await reader3.read();

    if (done) {
      break;
    }

    chunks3++;
    receivedBytes += value.length;
    console.log(`  Chunk ${chunks3} : ${value.length} octets (total : ${receivedBytes} octets)`);
  }

  console.log(`\n✅ Téléchargement simulé : ${receivedBytes} octets en ${chunks3} chunks\n`);

  // Exemple 4 : suivi + sauvegarde
  console.log('📊 Exemple 4 : suivi et sauvegarde (simulés)\n');

  const progressStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const totalSize = 1024 * 10;
      const chunkSize = 1024;
      let sent = 0;

      const interval = setInterval(() => {
        if (sent < totalSize) {
          const chunk = new Uint8Array(Math.min(chunkSize, totalSize - sent));
          chunk.fill(42);
          controller.enqueue(chunk);
          sent += chunk.length;

          const progress = ((sent / totalSize) * 100).toFixed(1);
          console.log(`  Progression : ${progress}% (${sent}/${totalSize} octets)`);
        } else {
          clearInterval(interval);
          controller.close();
          console.log('  Téléchargement terminé !\n');
        }
      }, 100);
    },
  });

  const progressNext = async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/octet-stream', 'content-length': '10240' },
    data: progressStream,
    ok: true,
  });

  const progressPolicy = parse.stream();
  const progressResponse = await progressPolicy({ url: '/bytes/10240', method: 'GET', headers: {} }, progressNext);

  console.log('Suivi de progression :\n');

  const progressReader = (progressResponse.data as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { done } = await progressReader.read();
    if (done) break;
  }

  const saveStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const data = new TextEncoder().encode('Contenu de fichier à écrire sur disque');
      controller.enqueue(data);
      controller.close();
    },
  });

  const saveNext = async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/octet-stream' },
    data: saveStream,
    ok: true,
  });

  const savePolicy = parse.stream();
  const saveResponse = await savePolicy({ url: '/download', method: 'GET', headers: {} }, saveNext);

  const saveReader = (saveResponse.data as ReadableStream<Uint8Array>).getReader();
  const chunks4: Uint8Array[] = [];

  while (true) {
    const { done, value } = await saveReader.read();
    if (done) break;
    chunks4.push(value);
  }

  const totalLength = chunks4.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks4) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(combined);
  console.log('\nContenu sauvegardé :');
  console.log(`"${text}"`);
  console.log('\n(En production, écrire directement sur disque via fs.createWriteStream().write(chunk))\n');

  console.log('✨ Exemples terminés !');
  console.log('\n💡 Bénéfices :');
  console.log('1. Faible empreinte mémoire');
  console.log('2. Suivi de progression simple');
  console.log('3. Chaînage direct vers disque ou réseau');
  console.log('4. Fichiers plus gros que la RAM disponible');
  console.log('5. Traitement possible avant la fin du téléchargement');
} catch (error) {
  console.error('❌ Échec du téléchargement en streaming :', error);
}
```

---

<p align="center">
  <a href="#/fr/examples/interceptors">← Intercepteurs</a> · <a href="#/fr/README">Accueil →</a>
</p>