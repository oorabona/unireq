/**
 * Validation Example
 * Demonstrates response validation using Zod and Valibot adapters
 * Usage: pnpm example:validation
 */

import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import * as v from 'valibot';
import { z } from 'zod';
import { valibotAdapter, zodAdapter } from './validation-adapters.js';

console.log('🛡️  Validation Examples\n');

// Define schemas
const UserSchemaZod = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  email: z.string().email(),
});

const UserSchemaValibot = v.object({
  id: v.number(),
  name: v.string(),
  username: v.string(),
  email: v.pipe(v.string(), v.email()),
});

// Example 1: Validation with Zod
console.log('=== Example 1: Validation with Zod ===\n');

const apiZod = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserSchemaZod, zodAdapter()),
);

try {
  const response = await apiZod.get('/users/1');
  console.log('✅ Zod validation passed!');
  console.log('User:', response.data);
} catch (error) {
  console.error('❌ Zod validation failed:', error);
}

// Example 2: Validation with Valibot
console.log('\n=== Example 2: Validation with Valibot ===\n');

const apiValibot = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserSchemaValibot, valibotAdapter()),
);

try {
  const response = await apiValibot.get('/users/2');
  console.log('✅ Valibot validation passed!');
  console.log('User:', response.data);
} catch (error) {
  console.error('❌ Valibot validation failed:', error);
}

// Example 3: Validation Failure
console.log('\n=== Example 3: Validation Failure ===\n');

const InvalidSchema = z.object({
  id: z.string(), // Expecting string, but API returns number
});

const apiFail = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(InvalidSchema, zodAdapter()),
);

try {
  await apiFail.get('/users/1');
} catch (error) {
  console.log('✅ Validation correctly failed as expected');
  console.log('Error:', (error as Error).message);
}

console.log('\n✨ Validation examples completed!');
