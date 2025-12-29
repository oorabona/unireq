/**
 * Streaming download example
 * Demonstrates streaming large file downloads with ReadableStream
 * Uses httpbin.org /stream-bytes endpoint for real streaming
 * Usage: pnpm example:streaming-download
 */

import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Create HTTP client
const api = client(http('https://httpbin.org'));

console.log('📥 Streaming Download Examples\n');

try {
  // Example 1: Real streaming download from httpbin.org
  console.log('📊 Example 1: Real streaming download from httpbin.org\n');

  console.log('Downloading from https://httpbin.org/stream-bytes/10240 (10KB)\n');

  const realResponse = await api.get('/stream-bytes/10240', parse.stream());

  console.log('Processing chunks as they arrive:\n');

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
    console.log(`  Chunk ${chunkCount}: ${value.length} bytes (total: ${bytesReceived} bytes)`);
  }

  console.log(`\n✅ Download complete: ${bytesReceived} bytes in ${chunkCount} chunks\n`);

  // Example 2: Multiple simultaneous streams
  console.log('📊 Example 2: Multiple file downloads\n');

  console.log('Downloading 3 different sizes in parallel:\n');

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
    console.log(`  File ${i + 1}: ${total} bytes downloaded`);
  }

  console.log('\n✅ All downloads complete\n');

  // Example 3: Simulated chunk processing demo
  console.log('📊 Example 3: Chunk processing demo (simulated)\n');

  // Simulate large download
  const mockData = new Uint8Array(1024 * 5); // 5KB
  for (let i = 0; i < mockData.length; i++) {
    mockData[i] = i % 256;
  }

  const downloadStream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Simulate chunked download
      const chunkSize = 1024;
      let offset = 0;

      const push = () => {
        if (offset < mockData.length) {
          const chunk = mockData.slice(offset, Math.min(offset + chunkSize, mockData.length));
          controller.enqueue(chunk);
          offset += chunkSize;
          // Simulate network delay
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

  console.log('Simulated chunked download:\n');

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
    console.log(`  Chunk ${chunks3}: ${value.length} bytes (total: ${receivedBytes} bytes)`);
  }

  console.log(`\n✅ Simulated download: ${receivedBytes} bytes in ${chunks3} chunks\n`);

  // Example 4: Save stream demo
  console.log('📊 Example 4: Save stream to output (simulated)\n');

  const progressStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const totalSize = 1024 * 10; // 10KB
      const chunkSize = 1024;
      let sent = 0;

      const interval = setInterval(() => {
        if (sent < totalSize) {
          const chunk = new Uint8Array(Math.min(chunkSize, totalSize - sent));
          chunk.fill(42);
          controller.enqueue(chunk);
          sent += chunk.length;

          const progress = ((sent / totalSize) * 100).toFixed(1);
          console.log(`  Progress: ${progress}% (${sent}/${totalSize} bytes)`);
        } else {
          clearInterval(interval);
          controller.close();
          console.log('  Download complete!\n');
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

  console.log('Progress tracking:\n');

  const progressReader = (progressResponse.data as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { done } = await progressReader.read();
    if (done) break;
  }

  const saveStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const data = new TextEncoder().encode('This is file content that would be saved to disk');
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

  // Combine chunks
  const totalLength = chunks4.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks4) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(combined);
  console.log('\nSaved content:');
  console.log(`"${text}"`);
  console.log('\n(In production, write to disk: fs.createWriteStream().write(chunk))\n');

  console.log('✨ Streaming download examples completed!');
  console.log('\n💡 Benefits of streaming downloads:');
  console.log('1. Low memory footprint - process chunks as they arrive');
  console.log('2. Progress tracking for large files');
  console.log('3. Pipe directly to disk/network without buffering');
  console.log('4. Handle files larger than available RAM');
  console.log('5. Start processing before download completes');
} catch (error) {
  console.error('❌ Streaming download failed:', error);
}
