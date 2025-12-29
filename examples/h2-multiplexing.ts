/**
 * HTTP/2 Multiplexing Example using preset.h2 facade
 *
 * This example demonstrates how to use the HTTP/2 facade for:
 * - Session management with connection pooling
 * - Multiplexed requests over a single connection
 * - JSON API calls with automatic parsing
 * - Retry and timeout policies
 *
 * Usage: pnpm example:h2
 *
 * Note: This example uses a real HTTP/2 endpoint to demonstrate
 * the benefits of multiplexing (parallel requests over single connection).
 */

import { preset } from '@unireq/presets';

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  company: { name: string };
}

interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

async function main() {
  console.log('🚀 HTTP/2 Multiplexing Example\n');
  console.log('='.repeat(50));

  // Build HTTP/2 client using the fluent facade API
  // This creates a managed session with connection pooling
  const api = preset.h2
    .uri('https://jsonplaceholder.typicode.com')
    .json.timeout.withRetry({ tries: 3 })
    .withHeaders({
      'User-Agent': 'Unireq-H2-Example/1.0',
    })
    .connector({
      enablePush: true,
      sessionTimeout: 30000, // Keep session alive for 30s
    })
    .build();

  console.log('\n📡 Making parallel API requests...\n');
  console.log('HTTP/2 multiplexes these over a single TCP connection!\n');

  const startTime = Date.now();

  // Make parallel requests - these all use the same HTTP/2 session
  // demonstrating the power of multiplexing
  const [postsResult, usersResult, commentsResult] = await Promise.all([
    api.get<Post[]>('/posts?_limit=5'),
    api.get<User[]>('/users?_limit=3'),
    api.get<Comment[]>('/comments?_limit=3'),
  ]);

  const parallelTime = Date.now() - startTime;

  console.log('📊 Results:\n');

  console.log('📝 Posts:');
  for (const post of postsResult.data.slice(0, 3)) {
    console.log(`  [#${post.id}] ${post.title.substring(0, 50)}...`);
  }

  console.log('\n👥 Users:');
  for (const user of usersResult.data) {
    console.log(`  [#${user.id}] ${user.name} (${user.company.name})`);
  }

  console.log('\n💬 Comments:');
  for (const comment of commentsResult.data) {
    console.log(`  [Post #${comment.postId}] ${comment.name.substring(0, 40)}...`);
  }

  console.log(`\n⚡ Parallel requests completed in ${parallelTime}ms`);

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n🔄 Making sequential requests for comparison...\n');

  const seqStartTime = Date.now();

  // Sequential requests - still uses same session (connection reuse)
  const post1 = await api.get<Post>('/posts/1');
  const post2 = await api.get<Post>('/posts/2');
  const post3 = await api.get<Post>('/posts/3');

  const sequentialTime = Date.now() - seqStartTime;

  console.log('📝 Sequential posts:');
  console.log(`  [#${post1.data.id}] ${post1.data.title.substring(0, 50)}...`);
  console.log(`  [#${post2.data.id}] ${post2.data.title.substring(0, 50)}...`);
  console.log(`  [#${post3.data.id}] ${post3.data.title.substring(0, 50)}...`);

  console.log(`\n⏱️  Sequential requests completed in ${sequentialTime}ms`);

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n🔒 Testing POST with JSON body...\n');

  // POST request with automatic JSON serialization
  const newPost = await api.post<Post>('/posts', {
    title: 'Hello from Unireq HTTP/2!',
    body: 'This post was created using the HTTP/2 facade.',
    userId: 1,
  });

  console.log('✅ Created post:');
  console.log(`  ID: ${newPost.data.id}`);
  console.log(`  Title: ${newPost.data.title}`);

  console.log(`\n${'='.repeat(50)}`);
  console.log('\n📊 Performance Summary:\n');
  console.log(`  Parallel requests (3):   ${parallelTime}ms`);
  console.log(`  Sequential requests (3): ${sequentialTime}ms`);
  console.log(`  Speedup: ${((sequentialTime / parallelTime) * 100 - 100).toFixed(1)}% faster with multiplexing`);

  console.log('\n✨ HTTP/2 example completed!\n');

  console.log('💡 Benefits of HTTP/2 multiplexing:');
  console.log('  • Single TCP connection for all requests');
  console.log('  • No head-of-line blocking at HTTP level');
  console.log('  • Header compression (HPACK)');
  console.log('  • Server push support');
  console.log('  • Connection reuse across requests\n');

  // Access raw client for advanced operations
  console.log('💡 Raw client also available via: api.raw.get(), api.raw.post(), etc.');
}

main().catch(console.error);
