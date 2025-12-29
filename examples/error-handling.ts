/**
 * Error handling example
 * Demonstrates structured error handling without external dependencies
 * Shows how to handle different error types and implement custom policies
 * Usage: pnpm example:error-handling
 */

import {
  client,
  HttpError,
  type Logger,
  log,
  NetworkError,
  retry,
  SerializationError,
  TimeoutError,
  UnireqError,
} from '@unireq/core';
import { http, parse } from '@unireq/http';

console.log('🔧 Error Handling Examples\n');

// =============================================================================
// Example 1: Basic try/catch with error type discrimination
// =============================================================================
console.log('Example 1: Error type discrimination\n');

const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

async function fetchWithErrorHandling<T>(path: string): Promise<T | null> {
  try {
    const response = await api.get<T>(path);
    return response.data;
  } catch (error) {
    // Discriminate by error type for specific handling
    if (error instanceof TimeoutError) {
      console.log(`⏱️  Timeout after ${error.timeoutMs}ms - consider increasing timeout`);
      return null;
    }

    if (error instanceof NetworkError) {
      console.log(`🌐 Network error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Cause: ${error.cause}`);
      return null;
    }

    if (error instanceof HttpError) {
      console.log(`📨 HTTP ${error.status}: ${error.statusText}`);

      // Handle specific HTTP status codes
      switch (error.status) {
        case 400:
          console.log('   → Invalid request, check your parameters');
          break;
        case 401:
          console.log('   → Authentication required');
          break;
        case 403:
          console.log('   → Access denied');
          break;
        case 404:
          console.log('   → Resource not found');
          break;
        case 429:
          console.log('   → Rate limited, please slow down');
          break;
        case 500:
          console.log('   → Server error, try again later');
          break;
        default:
          console.log(`   → Unhandled status: ${error.status}`);
      }

      // Access response data if available
      if (error.data) {
        console.log(`   → Error details: ${JSON.stringify(error.data)}`);
      }

      return null;
    }

    if (error instanceof SerializationError) {
      console.log(`📄 Parsing failed: ${error.message}`);
      return null;
    }

    // Generic UnireqError - catch-all for library errors
    if (error instanceof UnireqError) {
      console.log(`⚠️  Unireq error [${error.code}]: ${error.message}`);
      return null;
    }

    // Unknown error - rethrow
    throw error;
  }
}

// Test with a valid endpoint
const post = await fetchWithErrorHandling<{ id: number; title: string }>('/posts/1');
if (post) {
  console.log(`✅ Fetched post: ${post.title}\n`);
}

// =============================================================================
// Example 2: Structured error logging
// =============================================================================
console.log('Example 2: Structured error logging\n');

// Custom logger that captures errors with full context
interface ErrorLogEntry {
  timestamp: string;
  level: string;
  message: string;
  error?: {
    name: string;
    code: string;
    status?: number;
    cause?: string;
  };
  context?: Record<string, unknown>;
}

const errorLogs: ErrorLogEntry[] = [];

const structuredLogger: Logger = {
  debug: (msg, meta) =>
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message: msg,
      context: meta,
    }),
  info: (msg, meta) =>
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: msg,
      context: meta,
    }),
  warn: (msg, meta) =>
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: msg,
      context: meta,
    }),
  error: (msg, meta) =>
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: msg,
      context: meta,
    }),
};

const loggedApi = client(http('https://jsonplaceholder.typicode.com'), log({ logger: structuredLogger }), parse.json());

try {
  await loggedApi.get('/posts/1');
  console.log('✅ Request logged successfully');
  console.log(`   Total log entries: ${errorLogs.length}`);
} catch {
  // Errors are also logged
}

// =============================================================================
// Example 3: Custom error policy pattern
// =============================================================================
console.log('\nExample 3: Custom error policy pattern\n');

type ErrorHandler<T> = (error: unknown) => T | null;

interface ErrorPolicy<T> {
  onTimeout?: ErrorHandler<T>;
  onNetwork?: ErrorHandler<T>;
  onHttp?: (error: HttpError) => T | null;
  onSerialization?: ErrorHandler<T>;
  onUnknown?: ErrorHandler<T>;
}

function withErrorPolicy<T>(policy: ErrorPolicy<T>) {
  return async (fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof TimeoutError && policy.onTimeout) {
        return policy.onTimeout(error);
      }
      if (error instanceof NetworkError && policy.onNetwork) {
        return policy.onNetwork(error);
      }
      if (error instanceof HttpError && policy.onHttp) {
        return policy.onHttp(error);
      }
      if (error instanceof SerializationError && policy.onSerialization) {
        return policy.onSerialization(error);
      }
      if (policy.onUnknown) {
        return policy.onUnknown(error);
      }
      throw error;
    }
  };
}

// Define a reusable error policy
const apiErrorPolicy = withErrorPolicy<{ id: number; title: string }>({
  onTimeout: () => {
    console.log('   Policy: Timeout - returning cached data or null');
    return null;
  },
  onNetwork: () => {
    console.log('   Policy: Network error - offline mode');
    return null;
  },
  onHttp: (error) => {
    if (error.status === 404) {
      console.log('   Policy: 404 - resource not found, returning null');
      return null;
    }
    if (error.status >= 500) {
      console.log('   Policy: Server error - will be retried by retry policy');
    }
    throw error; // Rethrow other HTTP errors
  },
  onUnknown: () => {
    console.log('   Policy: Unknown error - logging and returning null');
    return null;
  },
});

const result = await apiErrorPolicy(async () => {
  const response = await api.get<{ id: number; title: string }>('/posts/1');
  return response.data;
});

if (result) {
  console.log(`✅ Policy result: ${result.title}`);
}

// =============================================================================
// Example 4: Aggregating errors from multiple requests
// =============================================================================
console.log('\nExample 4: Aggregating errors from parallel requests\n');

interface RequestResult<T> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    code?: string;
    status?: number;
  };
}

async function safeRequest<T>(promise: Promise<{ data: T }>): Promise<RequestResult<T>> {
  try {
    const response = await promise;
    return { success: true, data: response.data };
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        success: false,
        error: {
          type: 'HttpError',
          message: error.message,
          code: error.code,
          status: error.status,
        },
      };
    }
    if (error instanceof UnireqError) {
      return {
        success: false,
        error: {
          type: error.name,
          message: error.message,
          code: error.code,
        },
      };
    }
    return {
      success: false,
      error: {
        type: 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// Execute multiple requests in parallel, capturing all errors
const endpoints = ['/posts/1', '/posts/2', '/posts/999'];
const results = await Promise.all(endpoints.map((path) => safeRequest(api.get<{ id: number; title: string }>(path))));

// Analyze results
const successful = results.filter((r) => r.success);
const failed = results.filter((r) => !r.success);

console.log(`   Successful: ${successful.length}/${results.length}`);
console.log(`   Failed: ${failed.length}/${results.length}`);

for (const failure of failed) {
  if (failure.error) {
    console.log(`   ❌ ${failure.error.type}: ${failure.error.message}`);
  }
}

// =============================================================================
// Example 5: Retry with error logging
// =============================================================================
console.log('\nExample 5: Retry with error visibility\n');

let attemptCount = 0;

const retryApi = client(
  http('https://jsonplaceholder.typicode.com'),
  retry(
    (result, error, attempt) => {
      attemptCount = attempt;
      if (error) {
        console.log(`   Attempt ${attempt}: Error - ${error.message}`);
        return true; // Retry on error
      }
      // biome-ignore lint/suspicious/noExplicitAny: checking status at runtime
      const status = (result as any)?.status;
      if (status >= 500) {
        console.log(`   Attempt ${attempt}: Server error ${status}`);
        return true; // Retry on 5xx
      }
      return false;
    },
    [{ getDelay: () => 100 }], // Simple 100ms delay
    { tries: 3 },
  ),
  parse.json(),
);

try {
  const response = await retryApi.get<{ id: number; title: string }>('/posts/1');
  console.log(`✅ Success after ${attemptCount} attempt(s): ${response.data.title}`);
} catch (_error) {
  console.log(`❌ Failed after ${attemptCount} attempts`);
}

// =============================================================================
// Example 6: Error context enrichment
// =============================================================================
console.log('\nExample 6: Error context enrichment\n');

class EnrichedError extends Error {
  constructor(
    message: string,
    public readonly originalError: unknown,
    public readonly context: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EnrichedError';
  }
}

async function fetchWithContext<T>(path: string, context: Record<string, unknown>): Promise<T> {
  try {
    const response = await api.get<T>(path);
    return response.data;
  } catch (error) {
    // Enrich error with context
    throw new EnrichedError(`Request to ${path} failed`, error, {
      ...context,
      path,
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });
  }
}

try {
  await fetchWithContext('/posts/1', {
    userId: 'user-123',
    feature: 'posts',
    correlationId: crypto.randomUUID(),
  });
  console.log('✅ Request with context succeeded');
} catch (error) {
  if (error instanceof EnrichedError) {
    console.log(`   Error: ${error.message}`);
    console.log(`   Context: ${JSON.stringify(error.context, null, 2)}`);
  }
}

// =============================================================================
// Summary
// =============================================================================
console.log('\n📊 Error Handling Patterns Summary:\n');

console.log('1️⃣  Type Discrimination:');
console.log('   Use instanceof to handle specific error types differently\n');

console.log('2️⃣  Structured Logging:');
console.log('   Capture errors with full context for debugging\n');

console.log('3️⃣  Error Policies:');
console.log('   Define reusable strategies for error recovery\n');

console.log('4️⃣  Safe Parallel Requests:');
console.log('   Aggregate results and errors from concurrent operations\n');

console.log('5️⃣  Retry Visibility:');
console.log('   Log each retry attempt for observability\n');

console.log('6️⃣  Context Enrichment:');
console.log('   Add business context to errors for better debugging\n');

console.log('✨ Error handling examples completed!');
