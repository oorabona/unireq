/**
 * GraphQL mutation example
 * Demonstrates GraphQL mutations with input types and real API calls
 * Uses GraphQLZero - a free fake GraphQL API for testing
 * Usage: pnpm example:graphql-mutation
 */

import { client } from '@unireq/core';
import type { GraphQLResponse } from '@unireq/graphql';
import { graphql, mutation, variable } from '@unireq/graphql';
import { http, parse } from '@unireq/http';

console.log('✏️  GraphQL Mutation Examples\n');
console.log('💡 These examples demonstrate mutations with a real API\n');
console.log('   Using GraphQLZero API: https://graphqlzero.almansi.me/\n');

// Create GraphQL client for GraphQLZero API
const api = client(http('https://graphqlzero.almansi.me'));

try {
  // Example 1: Create post mutation
  console.log('📝 Example 1: Create post mutation\n');

  const createPostMutation = mutation(
    `
  createPost(input: $input) {
    id
    title
    body
  }
`,
    {
      operationName: 'CreatePost',
      variables: [
        variable('input', 'CreatePostInput!', {
          title: 'My First Post with @unireq/graphql',
          body: 'This post was created using the unireq GraphQL library. It demonstrates how easy it is to compose mutations with variables!',
        }),
      ],
    },
  );

  console.log('Creating post...');
  const createResponse = await api.post<
    GraphQLResponse<{
      createPost: {
        id: string;
        title: string;
        body: string;
      };
    }>
  >('/api', graphql(createPostMutation), parse.json());

  if (createResponse.data?.errors) {
    console.error('GraphQL errors:', createResponse.data.errors);
  } else if (createResponse.data?.data?.createPost) {
    const post = createResponse.data.data.createPost;
    console.log(`✅ Post created with ID: ${post.id}`);
    console.log(`   Title: ${post.title}`);
    console.log(`   Body: ${post.body.substring(0, 50)}...`);
  }

  // Example 2: Update post mutation
  console.log('\n📝 Example 2: Update post mutation\n');

  const updatePostMutation = mutation(
    `
  updatePost(id: $id, input: $input) {
    id
    title
    body
  }
`,
    {
      operationName: 'UpdatePost',
      variables: [
        variable('id', 'ID!', '1'),
        variable('input', 'UpdatePostInput!', {
          title: 'Updated Post Title',
          body: 'This post has been updated using @unireq/graphql mutations.',
        }),
      ],
    },
  );

  console.log('Updating post ID 1...');
  const updateResponse = await api.post<
    GraphQLResponse<{
      updatePost: {
        id: string;
        title: string;
        body: string;
      };
    }>
  >('/api', graphql(updatePostMutation), parse.json());

  if (updateResponse.data?.errors) {
    console.error('GraphQL errors:', updateResponse.data.errors);
  } else if (updateResponse.data?.data?.updatePost) {
    const post = updateResponse.data.data.updatePost;
    console.log(`✅ Post ${post.id} updated`);
    console.log(`   New title: ${post.title}`);
    console.log(`   New body: ${post.body.substring(0, 50)}...`);
  }

  // Example 3: Delete post mutation
  console.log('\n📝 Example 3: Delete post mutation\n');

  const deletePostMutation = mutation(
    `
  deletePost(id: $id)
`,
    {
      operationName: 'DeletePost',
      variables: [variable('id', 'ID!', '1')],
    },
  );

  console.log('Deleting post ID 1...');
  const deleteResponse = await api.post<GraphQLResponse<{ deletePost: boolean }>>(
    '/api',
    graphql(deletePostMutation),
    parse.json(),
  );

  if (deleteResponse.data?.errors) {
    console.error('GraphQL errors:', deleteResponse.data.errors);
  } else if (deleteResponse.data?.data?.deletePost !== undefined) {
    const success = deleteResponse.data.data.deletePost;
    console.log(`✅ Post deletion ${success ? 'successful' : 'failed'}`);
  }

  // Example 4: Multiple mutations in sequence
  console.log('\n📝 Example 4: Creating multiple posts\n');

  const postsToCreate = [
    {
      title: 'Introduction to GraphQL',
      body: 'GraphQL is a query language for APIs that provides a complete description of the data.',
    },
    {
      title: 'Why use @unireq/graphql?',
      body: 'Unireq provides a composable, type-safe way to work with GraphQL APIs.',
    },
    {
      title: 'GraphQL Best Practices',
      body: 'Learn how to structure your GraphQL queries and mutations for optimal performance.',
    },
  ];

  console.log(`Creating ${postsToCreate.length} posts...`);
  let createdCount = 0;

  for (const postData of postsToCreate) {
    const createMutation = mutation(
      `
    createPost(input: $input) {
      id
      title
    }
  `,
      {
        operationName: 'CreatePost',
        variables: [variable('input', 'CreatePostInput!', postData)],
      },
    );

    const response = await api.post<GraphQLResponse<{ createPost: { id: string; title: string } }>>(
      '/api',
      graphql(createMutation),
      parse.json(),
    );

    if (response.data?.data?.createPost) {
      createdCount++;
      console.log(`  ✅ Created: "${response.data.data.createPost.title}" (ID: ${response.data.data.createPost.id})`);
    }
  }

  console.log(`\n${createdCount}/${postsToCreate.length} posts created successfully`);

  console.log('\n✨ GraphQL mutation examples completed!');
  console.log('\n💡 Free GraphQL APIs for testing mutations:');
  console.log('- https://graphqlzero.almansi.me/api (Posts, Users, Comments, Todos)');
  console.log('- https://api.github.com/graphql (GitHub - requires token)');
  console.log('\n💡 @unireq/graphql mutation features:');
  console.log('- Type-safe mutation composition');
  console.log('- Variables with automatic serialization');
  console.log('- Input types validation');
  console.log('- Seamless error handling');
  console.log('- Works with any GraphQL API');
} catch (error) {
  console.error('❌ GraphQL mutation failed:', error);
}
