/**
 * External Editor Hook
 *
 * Opens $EDITOR for multiline input and returns the content.
 * Supports Ctrl+E trigger in CommandLine.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useCallback, useState } from 'react';

/**
 * Editor result
 */
export interface EditorResult {
  /** Content from editor (empty if cancelled) */
  content: string;
  /** Whether editing was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * External editor hook state
 */
export interface UseExternalEditorState {
  /** Whether editor is currently open */
  isEditing: boolean;
  /** Open editor with optional initial content */
  openEditor: (initialContent?: string) => EditorResult;
  /** Last error message */
  lastError?: string;
}

/**
 * Get the editor command from environment
 */
function getEditorCommand(): string {
  return process.env['VISUAL'] || process.env['EDITOR'] || 'vi';
}

/**
 * Create a temporary file for editing
 */
function createTempFile(content: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'unireq-'));
  const tempFile = join(tempDir, 'input.txt');
  writeFileSync(tempFile, content, 'utf-8');
  return tempFile;
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath: string): void {
  try {
    unlinkSync(filePath);
    // Try to remove parent temp directory
    const parentDir = filePath.replace(/\/[^/]+$/, '');
    unlinkSync(parentDir);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Hook for opening external editor
 *
 * @example
 * ```tsx
 * function CommandLine() {
 *   const { openEditor, isEditing } = useExternalEditor();
 *
 *   const handleCtrlE = () => {
 *     const result = openEditor();
 *     if (result.success && result.content) {
 *       setInput(input + ` -b '${result.content}'`);
 *     }
 *   };
 * }
 * ```
 */
export function useExternalEditor(): UseExternalEditorState {
  const [isEditing, setIsEditing] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();

  const openEditor = useCallback((initialContent = ''): EditorResult => {
    const editor = getEditorCommand();
    let tempFile: string | undefined;

    try {
      setIsEditing(true);
      setLastError(undefined);

      // Create temp file with initial content
      tempFile = createTempFile(initialContent);

      // Parse editor command (may include args like "code --wait")
      const parts = editor.split(/\s+/).filter(Boolean);
      const cmd = parts[0];
      const args = parts.slice(1);

      if (!cmd) {
        const errorMsg = 'No editor command found';
        setLastError(errorMsg);
        return { content: '', success: false, error: errorMsg };
      }

      // Spawn editor synchronously (blocks until closed)
      const result = spawnSync(cmd, [...args, tempFile], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      if (result.error) {
        const errorMsg = `Failed to open editor: ${result.error.message}`;
        setLastError(errorMsg);
        return { content: '', success: false, error: errorMsg };
      }

      if (result.status !== 0) {
        const errorMsg = `Editor exited with code ${result.status}`;
        setLastError(errorMsg);
        return { content: '', success: false, error: errorMsg };
      }

      // Read content from temp file
      const content = readFileSync(tempFile, 'utf-8').trim();

      return { content, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMsg);
      return { content: '', success: false, error: errorMsg };
    } finally {
      setIsEditing(false);
      if (tempFile) {
        cleanupTempFile(tempFile);
      }
    }
  }, []);

  return { isEditing, openEditor, lastError };
}
