/**
 * NDJSON Streaming Example
 *
 * Demonstrates parsing NDJSON (Newline Delimited JSON) streams,
 * commonly used in AI/LLM APIs for streaming responses.
 *
 * Run: pnpm tsx examples/ndjson-streaming.ts
 */

import { type NDJSONEvent, parse } from '@unireq/http';

// Simulated NDJSON response for demonstration
const mockNDJSONData = `{"role":"assistant","content":"Hello"}
{"role":"assistant","content":" there"}
{"role":"assistant","content":"!"}
{"role":"assistant","content":" How"}
{"role":"assistant","content":" can"}
{"role":"assistant","content":" I"}
{"role":"assistant","content":" help"}
{"role":"assistant","content":" you"}
{"role":"assistant","content":" today"}
{"role":"assistant","content":"?"}
{"done":true}`;

interface ChatDelta {
  role?: string;
  content?: string;
  done?: boolean;
}

async function main() {
  console.log('=== NDJSON Streaming Example ===\n');

  // Example 1: Basic NDJSON parsing
  console.log('--- Example 1: Basic NDJSON Parsing ---');

  // Create a ReadableStream from our mock data
  const mockStream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(mockNDJSONData));
      controller.close();
    },
  });

  // Simulate API response
  const mockNext = async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/x-ndjson' },
    data: mockStream,
    ok: true,
  });

  const policy = parse.ndjson<ChatDelta>();
  const response = await policy({ url: '', method: 'GET', headers: {} }, mockNext);

  let fullMessage = '';
  console.log('Streaming response:');

  for await (const event of response.data as AsyncIterable<NDJSONEvent<ChatDelta>>) {
    if (event.data.content) {
      process.stdout.write(event.data.content);
      fullMessage += event.data.content;
    }
    if (event.data.done) {
      console.log('\n[Stream complete]');
    }
  }

  console.log(`\nFull message: "${fullMessage}"`);

  // Example 2: Error handling for malformed lines
  console.log('\n--- Example 2: Error Handling ---');

  const mixedData = `{"valid":1}
not valid json
{"valid":2}
also not json
{"valid":3}`;

  const mixedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(mixedData));
      controller.close();
    },
  });

  const errorHandler = (line: string, error: Error) => {
    console.log(`  [Warning] Malformed line: "${line}" - ${error.message}`);
  };

  const errorPolicy = parse.ndjson<{ valid: number }>({ onError: errorHandler });
  const errorResponse = await errorPolicy({ url: '', method: 'GET', headers: {} }, async () => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: mixedStream,
    ok: true,
  }));

  const validEvents = [];
  for await (const event of errorResponse.data as AsyncIterable<NDJSONEvent<{ valid: number }>>) {
    validEvents.push(event.data);
  }
  console.log('Valid events parsed:', validEvents);

  // Example 3: Transform function
  console.log('\n--- Example 3: Transform Function ---');

  const rawData = `{"name":"alice","age":30}
{"name":"bob","age":25}
{"name":"charlie","age":35}`;

  interface Person {
    name: string;
    age: number;
  }

  interface PersonWithLabel {
    label: string;
    isAdult: boolean;
  }

  const transform = (data: unknown): PersonWithLabel => {
    const person = data as Person;
    return {
      label: `${person.name.toUpperCase()} (${person.age})`,
      isAdult: person.age >= 18,
    };
  };

  const transformStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(rawData));
      controller.close();
    },
  });

  const transformPolicy = parse.ndjson<PersonWithLabel>({ transform });
  const transformResponse = await transformPolicy({ url: '', method: 'GET', headers: {} }, async () => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: transformStream,
    ok: true,
  }));

  console.log('Transformed events:');
  for await (const event of transformResponse.data as AsyncIterable<NDJSONEvent<PersonWithLabel>>) {
    console.log(`  Line ${event.line}: ${event.data.label}, Adult: ${event.data.isAdult}`);
  }

  // Usage pattern with real API
  console.log('\n--- Real-world Usage Pattern ---');
  console.log(`
// OpenAI-style streaming API:
const api = client(
  http('https://api.openai.com/v1'),
  oauthBearer({ tokenSupplier: () => process.env.OPENAI_API_KEY }),
  parse.ndjson<ChatCompletionChunk>()
);

const response = await api.post('/chat/completions', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
});

for await (const chunk of response.data) {
  const content = chunk.data.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
`);

  console.log('\n=== NDJSON Example Complete ===');
}

main().catch(console.error);
