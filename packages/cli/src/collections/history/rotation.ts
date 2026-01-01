/**
 * History file rotation logic
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { rename, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

/**
 * Count the number of lines (entries) in a file
 * @param filePath - Path to the file
 * @returns Number of lines
 */
export async function countEntries(filePath: string): Promise<number> {
  try {
    await stat(filePath);
  } catch {
    return 0;
  }

  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });

    rl.on('line', (line) => {
      if (line.trim()) {
        count++;
      }
    });

    rl.on('close', () => {
      resolve(count);
    });

    rl.on('error', (error) => {
      reject(error);
    });

    stream.on('error', (error) => {
      // File might not exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve(0);
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Rotate history file by keeping only the most recent entries
 * @param filePath - Path to the history file
 * @param keepCount - Number of entries to keep
 */
export async function rotateHistory(filePath: string, keepCount: number): Promise<void> {
  const totalEntries = await countEntries(filePath);

  if (totalEntries <= keepCount) {
    return; // No rotation needed
  }

  const skipCount = totalEntries - keepCount;
  const tempPath = `${filePath}.tmp`;

  await new Promise<void>((resolve, reject) => {
    const readStream = createReadStream(filePath, { encoding: 'utf8' });
    const writeStream = createWriteStream(tempPath, { mode: 0o600 });
    const rl = createInterface({ input: readStream, crlfDelay: Number.POSITIVE_INFINITY });

    let lineNumber = 0;
    let writeError: Error | null = null;

    rl.on('line', (line) => {
      lineNumber++;
      if (lineNumber > skipCount && line.trim()) {
        writeStream.write(`${line}\n`);
      }
    });

    rl.on('close', () => {
      writeStream.end();
    });

    rl.on('error', (error) => {
      writeStream.destroy();
      reject(error);
    });

    writeStream.on('error', (error) => {
      writeError = error;
      rl.close();
    });

    writeStream.on('finish', () => {
      if (writeError) {
        reject(writeError);
      } else {
        resolve();
      }
    });
  });

  // Atomically replace the old file with the new one
  await rename(tempPath, filePath);
}

/**
 * Check if rotation is needed and perform it
 * @param filePath - Path to the history file
 * @param maxEntries - Maximum number of entries before rotation
 * @param keepRatio - Ratio of entries to keep (0-1)
 */
export async function rotateIfNeeded(filePath: string, maxEntries: number, keepRatio: number): Promise<boolean> {
  const entryCount = await countEntries(filePath);

  if (entryCount <= maxEntries) {
    return false;
  }

  const keepCount = Math.floor(maxEntries * keepRatio);
  await rotateHistory(filePath, keepCount);
  return true;
}
