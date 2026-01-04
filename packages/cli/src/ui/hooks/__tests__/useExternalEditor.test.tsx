/**
 * Tests for External Editor Hook
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { useExternalEditor } from '../useExternalEditor.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

// Mock fs operations
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    mkdtempSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import { spawnSync } from 'node:child_process';

// Test component
function TestComponent({ onResult }: { onResult: (state: ReturnType<typeof useExternalEditor>) => void }) {
  const state = useExternalEditor();
  onResult(state);
  return <Text>Editor: {state.isEditing ? 'open' : 'closed'}</Text>;
}

describe('useExternalEditor', () => {
  const mockSpawnSync = spawnSync as Mock;
  const mockMkdtempSync = mkdtempSync as Mock;
  const mockWriteFileSync = writeFileSync as Mock;
  const mockReadFileSync = readFileSync as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdtempSync.mockReturnValue('/tmp/unireq-test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with isEditing false', () => {
      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      expect(state.isEditing).toBe(false);
      expect(state.lastError).toBeUndefined();
    });

    it('should provide openEditor function', () => {
      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      expect(typeof state.openEditor).toBe('function');
    });
  });

  describe('Editor opening', () => {
    it('should use $VISUAL if set', () => {
      const originalVisual = process.env['VISUAL'];
      process.env['VISUAL'] = 'code --wait';

      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('test content');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      state.openEditor();

      expect(mockSpawnSync).toHaveBeenCalledWith('code', expect.arrayContaining(['--wait']), expect.any(Object));

      process.env['VISUAL'] = originalVisual;
    });

    it('should use $EDITOR if $VISUAL not set', () => {
      const originalVisual = process.env['VISUAL'];
      const originalEditor = process.env['EDITOR'];
      delete process.env['VISUAL'];
      process.env['EDITOR'] = 'nano';

      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      state.openEditor();

      expect(mockSpawnSync).toHaveBeenCalledWith('nano', expect.any(Array), expect.any(Object));

      process.env['VISUAL'] = originalVisual;
      process.env['EDITOR'] = originalEditor;
    });

    it('should fallback to vi if no editor set', () => {
      const originalVisual = process.env['VISUAL'];
      const originalEditor = process.env['EDITOR'];
      delete process.env['VISUAL'];
      delete process.env['EDITOR'];

      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      state.openEditor();

      expect(mockSpawnSync).toHaveBeenCalledWith('vi', expect.any(Array), expect.any(Object));

      process.env['VISUAL'] = originalVisual;
      process.env['EDITOR'] = originalEditor;
    });

    it('should create temp file with initial content', () => {
      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('edited content');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      state.openEditor('initial text');

      expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining('input.txt'), 'initial text', 'utf-8');
    });
  });

  describe('Success cases', () => {
    it('should return content from editor', () => {
      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('{"name": "test"}');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(true);
      expect(result.content).toBe('{"name": "test"}');
      expect(result.error).toBeUndefined();
    });

    it('should trim whitespace from content', () => {
      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('  content with whitespace  \n');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.content).toBe('content with whitespace');
    });

    it('should handle empty content', () => {
      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockReturnValue('');

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should handle spawn error', () => {
      mockSpawnSync.mockReturnValue({ error: new Error('Editor not found') });

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Editor not found');
    });

    it('should handle non-zero exit code', () => {
      mockSpawnSync.mockReturnValue({ status: 1 });

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(false);
      expect(result.error).toContain('exited with code 1');
    });

    it('should return error message on failure', () => {
      mockSpawnSync.mockReturnValue({ error: new Error('Test error') });

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should handle file read error', () => {
      mockSpawnSync.mockReturnValue({ status: 0 });
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      let state!: ReturnType<typeof useExternalEditor>;
      render(
        <TestComponent
          onResult={(s) => {
            state = s;
          }}
        />,
      );

      const result = state.openEditor();

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('Rendering', () => {
    it('should render closed state', () => {
      const { lastFrame } = render(<TestComponent onResult={() => {}} />);

      expect(lastFrame()).toContain('Editor: closed');
    });
  });
});
