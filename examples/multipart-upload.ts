/**
 * Multipart file upload example
 * Usage: pnpm example:multipart
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create base client (reusable for multiple uploads)
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('📤 Uploading multipart form with file and fields...\n');

try {
  // Create multipart upload with composable body descriptors
  const response = await api.post<{ files: Record<string, string>; form: Record<string, string> }>(
    '/post',
    body.multipart(
      {
        name: 'file',
        part: body.text('Hello from unireq multipart upload!'),
        filename: 'example.txt',
      },
      {
        name: 'image',
        part: body.binary(new Uint8Array([137, 80, 78, 71]).buffer, 'image/png'),
        filename: 'avatar.png',
      },
      {
        name: 'title',
        part: body.text('My Upload'),
      },
      {
        name: 'description',
        part: body.text('Testing multipart uploads with unireq'),
      },
      // Validation options
      {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['text/*', 'image/*'],
        sanitizeFilenames: true,
      },
    ),
    parse.json(),
  );

  console.log('✅ First upload successful!');
  console.log('\n📋 Response data:', response.data);

  // Second upload with different files (reusing the same client)
  console.log('\n📤 Uploading second file...\n');

  const response2 = await api.post<{ files: Record<string, string> }>(
    '/post',
    body.multipart({
      name: 'document',
      part: body.text('Second upload - different files!'),
      filename: 'report.txt',
    }),
    parse.json(),
  );

  console.log('✅ Second upload successful!');
  console.log('\n📋 Response data:', response2.data);
} catch (error) {
  console.error('❌ Upload failed:', error);
}

console.log('\n✨ Multipart example completed!');
