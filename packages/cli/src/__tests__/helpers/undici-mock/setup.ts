/**
 * Undici MockAgent setup for integration tests
 * Replaces MSW for testing with undici.request()
 * @see https://undici.nodejs.org/docs/docs/api/MockAgent
 */

import { Agent, MockAgent, type MockPool, setGlobalDispatcher } from 'undici';

// Store original agent for restoration
let originalAgent: Agent | undefined;
let mockAgent: MockAgent | undefined;

/**
 * Create and configure a MockAgent for testing
 * Call this in beforeAll()
 */
export function setupMockAgent(): MockAgent {
  if (mockAgent) {
    return mockAgent;
  }

  // Store original agent for restoration
  originalAgent = new Agent();

  // Create mock agent
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);

  return mockAgent;
}

/**
 * Get mock pool for a specific origin
 * Use this to set up intercepts for a host
 */
export function getMockPool(origin: string): MockPool {
  if (!mockAgent) {
    throw new Error('MockAgent not initialized. Call setupMockAgent() in beforeAll()');
  }
  return mockAgent.get(origin);
}

/**
 * Reset all mock handlers (call in afterEach)
 */
export function resetMockHandlers(): void {
  // MockAgent doesn't have a reset method like MSW
  // Pending interceptors are consumed on use, so no action needed
  // But we can check for pending interceptors as a sanity check
}

/**
 * Close mock agent and restore original dispatcher (call in afterAll)
 */
export async function closeMockAgent(): Promise<void> {
  if (mockAgent) {
    await mockAgent.close();
    mockAgent = undefined;
  }
  if (originalAgent) {
    setGlobalDispatcher(originalAgent);
    originalAgent = undefined;
  }
}

/**
 * Get the current mock agent instance
 */
export function getMockAgent(): MockAgent {
  if (!mockAgent) {
    throw new Error('MockAgent not initialized. Call setupMockAgent() in beforeAll()');
  }
  return mockAgent;
}

/**
 * Re-export MockAgent types for convenience
 */
export { MockAgent, type MockPool } from 'undici';
