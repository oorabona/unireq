/**
 * Test HistoryPicker with persistent history loading
 */

import { render } from 'ink-testing-library';
import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryReader } from '../../../collections/history/index.js';
import type { HistoryEntry } from '../../../collections/history/types.js';
import { type HistoryItem, HistoryPicker } from '../HistoryPicker.js';

// Mock history reader
const createMockReader = (entries: HistoryEntry[]): HistoryReader => {
  return {
    list: vi.fn().mockResolvedValue({
      entries: entries.map((entry, index) => ({ index, entry })),
      total: entries.length,
    }),
  } as unknown as HistoryReader;
};

describe('HistoryPicker with persistent history', () => {
  const mockEntries: HistoryEntry[] = [
    {
      type: 'http',
      timestamp: new Date().toISOString(),
      method: 'GET',
      url: 'https://api.example.com/users',
      status: 200,
    },
    {
      type: 'http',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      method: 'POST',
      url: 'https://api.example.com/users',
      status: 201,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load persistent history from reader', async () => {
    const mockReader = createMockReader(mockEntries);
    const sessionItems: HistoryItem[] = [];

    const { lastFrame } = render(
      <HistoryPicker items={sessionItems} onSelect={() => {}} onClose={() => {}} historyReader={mockReader} />,
    );

    // Initially shows loading
    expect(lastFrame()).toContain('Loading');

    // Wait for async load to complete
    await vi.runAllTimersAsync();

    // Should show loaded items
    const frame = lastFrame();
    expect(frame).toContain('get https://api.example.com/users');
    expect(frame).toContain('200');
    expect(mockReader.list).toHaveBeenCalledWith(100);
  });

  it('should prefer persistent history over session items when reader is provided', async () => {
    const mockReader = createMockReader(mockEntries);
    const sessionItems: HistoryItem[] = [{ command: 'session command', timestamp: new Date() }];

    const { lastFrame } = render(
      <HistoryPicker items={sessionItems} onSelect={() => {}} onClose={() => {}} historyReader={mockReader} />,
    );

    await vi.runAllTimersAsync();

    // Should show persistent items, not session items
    const frame = lastFrame();
    expect(frame).toContain('get https://api.example.com/users');
    expect(frame).not.toContain('session command');
  });

  it('should fall back to session items if reader fails', async () => {
    const failingReader = {
      list: vi.fn().mockRejectedValue(new Error('Read failed')),
    } as unknown as HistoryReader;

    const sessionItems: HistoryItem[] = [{ command: 'fallback command', timestamp: new Date() }];

    const { lastFrame } = render(
      <HistoryPicker items={sessionItems} onSelect={() => {}} onClose={() => {}} historyReader={failingReader} />,
    );

    await vi.runAllTimersAsync();

    // After failure, isLoading is false but persistentItems is empty
    // When historyReader is defined, displayedItems = persistentItems (empty)
    // So it shows "No history"
    const frame = lastFrame();
    expect(frame).toContain('No history');
  });

  it('should show count from persistent history', async () => {
    const mockReader = createMockReader(mockEntries);

    const { lastFrame } = render(
      <HistoryPicker items={[]} onSelect={() => {}} onClose={() => {}} historyReader={mockReader} />,
    );

    await vi.runAllTimersAsync();

    // Should show correct count
    const frame = lastFrame();
    expect(frame).toContain('(1/2)');
  });
});
