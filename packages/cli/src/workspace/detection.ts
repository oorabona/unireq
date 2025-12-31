/**
 * Workspace detection - find .unireq directory in filesystem hierarchy
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { WORKSPACE_DIR_NAME } from './constants.js';
import type { FindWorkspaceOptions, WorkspaceInfo } from './types.js';

/**
 * Check if a path is a directory (follows symlinks)
 */
function isDirectory(path: string): boolean {
  try {
    const stat = statSync(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if we've reached the filesystem root
 */
function isRoot(path: string): boolean {
  const parsed = parse(path);
  return parsed.root === path;
}

/**
 * Find the nearest workspace directory by walking up from the start directory.
 *
 * Algorithm:
 * 1. Start from startDir (defaults to cwd)
 * 2. Check if .unireq/ directory exists
 * 3. If found, return workspace info
 * 4. If not, move to parent directory
 * 5. Repeat until root is reached
 * 6. Return null if no workspace found
 *
 * @param options - Optional configuration
 * @returns WorkspaceInfo if found, null otherwise
 */
export function findWorkspace(options: FindWorkspaceOptions = {}): WorkspaceInfo | null {
  let currentDir = options.startDir ?? process.cwd();

  while (true) {
    const workspacePath = join(currentDir, WORKSPACE_DIR_NAME);

    // Check if .unireq exists AND is a directory (not a file)
    if (existsSync(workspacePath) && isDirectory(workspacePath)) {
      return {
        path: workspacePath,
        scope: 'local',
      };
    }

    // Check if we've reached the root
    if (isRoot(currentDir)) {
      return null;
    }

    // Move to parent directory
    const parentDir = dirname(currentDir);

    // Safety check: if dirname returns the same path, we're stuck
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}
