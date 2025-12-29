/**
 * Streaming upload example
 * Demonstrates streaming large file uploads with ReadableStream
 * Usage: pnpm example:streaming-upload
 */

import { body, http } from '@unireq/http';

console.log('📤 Streaming Upload Examples\n');

try {
  // Example 1: Upload large data as stream
  console.log('📊 Example 1: Stream upload with content length\n');

  // Simulate large data stream (in real scenario, this would be file.stream())
  const data = new Uint8Array(1024 * 10); // 10KB
  for (let i = 0; i < data.length; i++) {
    data[i] = i % 256;
  }

  const dataStream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Chunk the data into smaller pieces
      const chunkSize = 1024;
      let offset = 0;

      const push = () => {
        if (offset < data.length) {
          const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
          controller.enqueue(chunk);
          offset += chunkSize;
          // Simulate async chunks
          setTimeout(push, 10);
        } else {
          controller.close();
        }
      };

      push();
    },
  });

  console.log('Streaming 10KB of data...');
  console.log('Content-Type: application/octet-stream');
  console.log('Content-Length: 10240 bytes\n');

  // Demonstrate how to use body.stream() for streaming uploads
  const streamBody = body.stream(dataStream, {
    contentType: 'application/octet-stream',
    contentLength: 10240,
  });

  console.log('✨ Stream body created successfully!');
  console.log(`Stream configuration: ${JSON.stringify({ transport: http })}`);
  console.log(`Body descriptor: ${JSON.stringify({ contentType: streamBody.contentType })}`);
  console.log('In production, this would upload data in chunks without loading the entire file in memory.\n');

  // Example 2: Upload video file stream
  console.log('📊 Example 2: Video file stream\n');

  const videoChunk = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]); // MP4 header
  const videoStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(videoChunk);
      controller.close();
    },
  });

  const videoDescriptor = body.stream(videoStream, {
    contentType: 'video/mp4',
    contentLength: videoChunk.length,
  });

  console.log('Video stream descriptor created:');
  console.log('- Content-Type:', videoDescriptor.contentType);
  console.log('- Content-Length:', videoDescriptor.contentLength);
  console.log('- Stream:', videoDescriptor.data);

  console.log('\n✨ Streaming upload examples completed!');
  console.log('\n💡 Benefits of streaming uploads:');
  console.log('1. Low memory footprint - data not fully loaded');
  console.log('2. Progress tracking with content-length');
  console.log('3. Efficient for large files (videos, backups, logs)');
  console.log('4. Works with File.stream() API in browsers');
} catch (error) {
  console.error('❌ Streaming upload failed:', error);
}
