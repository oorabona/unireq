/**
 * Basic HTTP request example
 * Usage: pnpm example:http
 */

import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Create client with HTTP transport and JSON parser
const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// Make a GET request
const response = await api.get<{ id: number; title: string }>('/posts/1');

console.log('✅ HTTP GET successful!');
console.log(`Status: ${response.status}`);
console.log(`Title: ${response.data.title}`);
console.log(`Full response: ${JSON.stringify(response.data, null, 2)}`);
