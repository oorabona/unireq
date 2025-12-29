/**
 * CI/CD build artifacts upload example
 * Demonstrates uploading mixed build artifacts (manifest, results, coverage, binary, logs)
 * Usage: pnpm example:ci-artifacts
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create client for CI/CD API
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('🔨 Uploading CI/CD build artifacts...\n');

try {
  // Build manifest
  const manifest = {
    buildId: 'build-12345',
    version: '1.2.3',
    branch: 'main',
    commit: 'a1b2c3d4e5f6',
    timestamp: new Date().toISOString(),
    duration: 245, // seconds
    status: 'success',
  };

  // Test results in JUnit XML format
  const junitResults = `<?xml version="1.0"?>
<testsuites tests="394" failures="0" errors="0" time="4.25">
  <testsuite name="@unireq/core" tests="35" failures="0" time="0.017">
    <testcase name="should create a client with transport" time="0.002"/>
    <testcase name="should execute request with transport" time="0.001"/>
  </testsuite>
  <testsuite name="@unireq/http" tests="50" failures="0" time="0.167">
    <testcase name="should handle multipart uploads" time="0.012"/>
  </testsuite>
</testsuites>`;

  // Coverage report (JSON)
  const coverageData = {
    total: {
      lines: { pct: 100 },
      statements: { pct: 100 },
      functions: { pct: 100 },
      branches: { pct: 100 },
    },
    files: 42,
    coverage: '100%',
  };

  // Simulated compiled binary
  const compiledBinary = new Uint8Array([
    0x7f,
    0x45,
    0x4c,
    0x46, // ELF header
    0x02,
    0x01,
    0x01,
    0x00,
  ]).buffer;

  // Build logs
  const buildLogs = `[2025-01-17 10:30:00] Starting build...
[2025-01-17 10:30:05] Installing dependencies...
[2025-01-17 10:30:45] Running type check...
[2025-01-17 10:31:00] Running tests...
[2025-01-17 10:31:30] All tests passed ✓
[2025-01-17 10:31:35] Generating coverage report...
[2025-01-17 10:31:40] Coverage: 100% ✓
[2025-01-17 10:31:45] Building bundles...
[2025-01-17 10:32:00] Build completed successfully!`;

  // Upload all artifacts in one request
  await api.post<{
    files: Record<string, string>;
    form: Record<string, string>;
  }>(
    '/post',
    body.multipart(
      // Build manifest (JSON)
      {
        name: 'manifest',
        part: body.json(manifest),
        filename: 'build-manifest.json',
      },
      // Test results (XML - JUnit format)
      {
        name: 'test_results',
        part: body.text(junitResults),
        filename: 'junit-results.xml',
      },
      // Coverage report (JSON)
      {
        name: 'coverage',
        part: body.json(coverageData),
        filename: 'coverage.json',
      },
      // Compiled binary
      {
        name: 'binary',
        part: body.binary(compiledBinary, 'application/octet-stream'),
        filename: `app-v${manifest.version}.bin`,
      },
      // Build logs (text)
      {
        name: 'logs',
        part: body.text(buildLogs),
        filename: 'build.log',
      },
    ),
    parse.json(),
  );

  console.log('✅ Artifacts uploaded successfully!');
  console.log(`\n🔨 Build: ${manifest.buildId}`);
  console.log(`📦 Version: ${manifest.version}`);
  console.log(`🌿 Branch: ${manifest.branch}`);
  console.log(`⏱️  Duration: ${manifest.duration}s`);
  console.log('\n📋 Uploaded artifacts:');
  console.log('  - Build manifest (JSON)');
  console.log('  - Test results (XML/JUnit)');
  console.log('  - Coverage report (JSON)');
  console.log('  - Binary executable (bin)');
  console.log('  - Build logs (text)');
  console.log('\n✨ All artifacts archived in a single request!');
} catch (error) {
  console.error('❌ Artifact upload failed:', error);
}
