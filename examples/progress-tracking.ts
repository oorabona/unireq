/**
 * Progress Tracking Example
 *
 * Demonstrates upload and download progress tracking
 * for file transfers and large data operations.
 *
 * Run: pnpm tsx examples/progress-tracking.ts
 */

import { client } from '@unireq/core';
import { http, type ProgressEvent, parse, progress } from '@unireq/http';

// Simple progress bar renderer
function renderProgressBar(percent: number, width = 40): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return `[${bar}] ${percent.toFixed(1)}%`;
}

// Format bytes
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Format time
function formatTime(seconds: number | undefined): string {
  if (seconds === undefined) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function main() {
  console.log('=== Progress Tracking Example ===\n');

  // Create client with progress tracking
  const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

  // Example 1: Download progress
  console.log('--- Example 1: Download Progress ---');

  const downloadProgress = (event: ProgressEvent) => {
    if (event.percent !== undefined) {
      process.stdout.write(`\r${renderProgressBar(event.percent)}`);
      process.stdout.write(` ${formatBytes(event.loaded)}`);
      if (event.total) process.stdout.write(`/${formatBytes(event.total)}`);
      process.stdout.write(` | ${formatBytes(event.rate)}/s`);
      process.stdout.write(` | ETA: ${formatTime(event.eta)}`);
    }
  };

  console.log('Downloading posts...');
  const response = await api.get('/posts', progress({ onDownloadProgress: downloadProgress }));
  console.log('\nDownload complete!');
  console.log(`Received ${(response.data as unknown[]).length} posts\n`);

  // Example 2: Upload progress simulation
  console.log('--- Example 2: Upload Progress ---');

  const uploadProgress = (event: ProgressEvent) => {
    if (event.percent !== undefined) {
      process.stdout.write(`\rUpload: ${renderProgressBar(event.percent)}`);
      process.stdout.write(` ${formatBytes(event.rate)}/s`);
    }
  };

  // Create a large payload to see progress
  const largePayload = {
    title: 'Large Post',
    body: 'x'.repeat(10000), // 10KB of data
    userId: 1,
  };

  console.log(`Uploading ${formatBytes(JSON.stringify(largePayload).length)}...`);
  const uploadResponse = await api.post('/posts', largePayload, progress({ onUploadProgress: uploadProgress }));
  console.log('\nUpload complete!');
  console.log(`Created post ID: ${(uploadResponse.data as { id: number }).id}\n`);

  // Example 3: Both upload and download
  console.log('--- Example 3: Bidirectional Progress ---');

  let phase = 'upload';
  const bidirectionalProgress = (event: ProgressEvent) => {
    const prefix = phase === 'upload' ? '\u2191 Upload' : '\u2193 Download';
    if (event.percent !== undefined) {
      process.stdout.write(`\r${prefix}: ${renderProgressBar(event.percent)}`);
    }
  };

  console.log('Sending request with bidirectional tracking...');
  await api.post(
    '/posts',
    { title: 'Test', body: 'Content', userId: 1 },
    progress({
      onUploadProgress: (e) => {
        phase = 'upload';
        bidirectionalProgress(e);
      },
      onDownloadProgress: (e) => {
        phase = 'download';
        bidirectionalProgress(e);
      },
    }),
  );
  console.log('\nRequest complete!\n');

  // Example 4: Throttled updates
  console.log('--- Example 4: Throttled Progress Updates ---');

  let updateCount = 0;
  const throttledProgress = () => {
    updateCount++;
  };

  await api.get(
    '/posts',
    progress({
      onDownloadProgress: throttledProgress,
      throttle: 50, // Update every 50ms max
    }),
  );
  console.log(`Received ${updateCount} progress updates (throttled to 50ms intervals)`);

  // Usage patterns
  console.log('\n--- Real-world Usage Patterns ---');
  console.log(`
// File upload with progress:
const uploadFile = async (file: File) => {
  return api.post('/files/upload', file, progress({
    onUploadProgress: ({ percent, rate, eta }) => {
      updateUI({
        progress: percent,
        speed: \`\${formatBytes(rate)}/s\`,
        remaining: formatTime(eta),
      });
    },
    throttle: 100, // Update UI every 100ms max
  }));
};

// Large file download with resume:
const downloadFile = async (url: string, onProgress: (p: number) => void) => {
  return api.get(url,
    progress({
      onDownloadProgress: ({ percent }) => {
        if (percent !== undefined) onProgress(percent);
      },
    }),
    parse.binary()
  );
};

// Batch operations with aggregate progress:
const uploadBatch = async (files: File[]) => {
  let completed = 0;

  for (const file of files) {
    await api.post('/upload', file, progress({
      onUploadProgress: ({ percent }) => {
        const totalProgress = ((completed + (percent || 0) / 100) / files.length) * 100;
        updateBatchProgress(totalProgress);
      },
    }));
    completed++;
  }
};
`);

  console.log('\n=== Progress Tracking Example Complete ===');
}

main().catch(console.error);
