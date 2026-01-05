/**
 * Integration tests for InputHistory
 * Tests file persistence and round-trip behavior
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getHistoryFilePath, InputHistory } from '../input-history.js';

describe('InputHistory Integration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `history-integration-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should integrate with getHistoryFilePath', () => {
    // Arrange & Act
    const path = getHistoryFilePath(testDir);

    // Assert
    expect(path).toBe(join(testDir, '.unireq', 'repl_history'));
  });

  it('should round-trip history through file', () => {
    // Arrange
    const history1 = new InputHistory({ workspace: testDir });
    history1.add('command1');
    history1.add('command2');
    history1.add('command3');
    history1.save();

    // Act - Create new instance that should load saved history
    const history2 = new InputHistory({ workspace: testDir });

    // Assert
    expect(history2.getAll()).toEqual(['command1', 'command2', 'command3']);
  });

  it('should create history directory if not exists', () => {
    // Arrange
    const history = new InputHistory({ workspace: testDir });
    history.add('test-command');

    // Act
    history.save();

    // Assert
    const historyPath = join(testDir, '.unireq', 'repl_history');
    expect(existsSync(historyPath)).toBe(true);
  });
});
