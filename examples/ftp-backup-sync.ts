/**
 * FTP Backup Sync Example using preset.ftp facade
 *
 * This example demonstrates how to use the FTP facade for file operations:
 * - Listing directory contents
 * - Downloading files
 * - Uploading files
 * - Creating/removing directories
 * - Renaming files
 *
 * Usage: pnpm example:ftp
 *
 * Note: This example uses mock implementations for demonstration.
 * In production, the default BasicFtpConnector will be used automatically.
 */

import type { FTPConnector, FTPFileEntry, FTPSession } from '@unireq/ftp';
import { preset } from '@unireq/presets';

// Create a mock FTP connector for demonstration
// In production, simply omit the .connector() call to use the default BasicFtpConnector
function createMockConnector(): FTPConnector {
  const mockSession: FTPSession = {
    connected: true,
    host: 'ftp.example.com',
    user: 'backup-user',
    secure: true,
  };

  // Simulated file listing
  const mockFiles: FTPFileEntry[] = [
    { name: 'documents', type: 1, size: 0 },
    { name: 'images', type: 1, size: 0 },
    { name: 'readme.txt', type: 0, size: 1024 },
    { name: 'backup-2025-01.zip', type: 0, size: 1048576 },
    { name: 'config.json', type: 0, size: 256 },
  ];

  return {
    capabilities: {
      ftp: true,
      ftps: true,
      delete: true,
      rename: true,
      mkdir: true,
      rmdir: true,
    },

    connect: async (uri) => {
      console.log(`🔌 Connected to FTP server: ${uri}`);
      return mockSession;
    },

    request: async (_session, context) => {
      const operation = context['operation'] as string;
      const destination = context['destination'] as string | undefined;

      switch (operation) {
        case 'list':
          console.log(`📂 Listing directory: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: mockFiles,
            ok: true,
          };

        case 'get':
          console.log(`⬇️  Downloading: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: Buffer.from(`Content of ${context.url}`),
            ok: true,
          };

        case 'put':
          console.log(`⬆️  Uploading to: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { uploaded: true },
            ok: true,
          };

        case 'delete':
          console.log(`🗑️  Deleting file: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { deleted: true, path: context.url },
            ok: true,
          };

        case 'rename':
          console.log(`📝 Renaming: ${context.url} -> ${destination}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { renamed: true, from: context.url, to: destination },
            ok: true,
          };

        case 'mkdir':
          console.log(`📁 Creating directory: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { created: true, path: context.url },
            ok: true,
          };

        case 'rmdir':
          console.log(`🗑️  Removing directory: ${context.url}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { removed: true, path: context.url },
            ok: true,
          };

        default:
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: {},
            data: { error: `Unknown operation: ${operation}` },
            ok: false,
          };
      }
    },

    disconnect: () => {
      console.log('🔌 Disconnected from FTP server');
    },
  };
}

async function main() {
  console.log('📁 FTP Backup Sync Example\n');
  console.log('='.repeat(50));

  // Create mock connector for demonstration
  const mockConnector = createMockConnector();

  // Build FTP facade using the fluent API
  // In production, omit .connector() to use the default BasicFtpConnector:
  //   const ftp = preset.ftp
  //     .uri('ftp://user:pass@ftp.example.com')
  //     .withRetry({ tries: 3 })
  //     .build();
  const ftp = preset.ftp
    .uri('ftp://backup-user:secret@ftp.example.com')
    .connector(mockConnector)
    .withRetry({ tries: 3 })
    .build();

  console.log('\n📂 Listing remote directory...\n');

  // List directory contents
  const files = await ftp.list('/backups');

  console.log(`\n📋 Found ${files.length} items:\n`);

  for (const file of files) {
    const type = file.type === 1 ? '📁' : '📄';
    const size = file.type === 0 ? ` (${file.size} bytes)` : '';
    console.log(`  ${type} ${file.name}${size}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n⬇️  Downloading backup file...\n');

  // Download a file
  const backupContent = await ftp.download('/backups/backup-2025-01.zip');
  console.log(`Downloaded ${backupContent.length} bytes`);

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n📁 Creating backup directory structure...\n');

  // Create directories
  await ftp.mkdir('/backups/2025/january');

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n⬆️  Uploading new backup...\n');

  // Upload a backup file
  const newBackup = JSON.stringify({
    timestamp: new Date().toISOString(),
    files: ['file1.txt', 'file2.txt'],
    checksum: 'abc123',
  });

  await ftp.upload('/backups/2025/january/backup-latest.json', newBackup);

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n📝 Renaming old backup...\n');

  // Rename (archive) an old file
  await ftp.rename('/backups/backup-2025-01.zip', '/backups/archive/backup-2025-01.zip');

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n🗑️  Cleaning up old files...\n');

  // Delete old config
  await ftp.delete('/backups/config.json');

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n🗑️  Removing empty directory...\n');

  // Remove empty directory
  await ftp.rmdir('/backups/temp');

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n📊 Backup sync summary:\n');
  console.log('  ✅ Listed remote directory');
  console.log('  ✅ Downloaded backup file');
  console.log('  ✅ Created directory structure');
  console.log('  ✅ Uploaded new backup');
  console.log('  ✅ Archived old backup');
  console.log('  ✅ Cleaned up old files');

  console.log('\n✨ FTP backup sync completed!\n');

  // Access raw client for advanced operations
  console.log('💡 Raw client also available via: ftp.raw.get(), ftp.raw.put(), etc.');
}

main().catch(console.error);
