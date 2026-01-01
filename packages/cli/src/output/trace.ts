/**
 * Trace output formatting for timing information
 */

import type { TimingInfo } from '@unireq/http';
import { bold, dim, shouldUseColors } from './colors.js';

/**
 * Format a duration in milliseconds for display
 */
function formatDuration(ms: number): string {
  if (ms < 1) {
    return '<1ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Create a timing bar visualization
 * @param value Current phase duration
 * @param total Total duration
 * @param width Bar width in characters
 */
function createTimingBar(value: number, total: number, width: number): string {
  if (total === 0) {
    return '─'.repeat(width);
  }

  const filledWidth = Math.round((value / total) * width);
  const filled = '█'.repeat(Math.min(filledWidth, width));
  const empty = '─'.repeat(width - filled.length);

  return filled + empty;
}

/**
 * Trace output options
 */
export interface TraceOptions {
  /** Use colors in output */
  useColors?: boolean;
}

/**
 * Format timing information for trace output
 */
export function formatTrace(timing: TimingInfo, options: TraceOptions = {}): string {
  const useColors = options.useColors ?? shouldUseColors();
  const lines: string[] = [];
  const barWidth = 20;

  // Header
  lines.push('');
  lines.push(bold('Timing', useColors));
  lines.push('─'.repeat(50));

  // TTFB (Time to First Byte)
  const ttfbBar = createTimingBar(timing.ttfb, timing.total, barWidth);
  const ttfbLine = `  TTFB:     ${ttfbBar} ${formatDuration(timing.ttfb)}`;
  lines.push(ttfbLine);

  // Download
  const downloadBar = createTimingBar(timing.download, timing.total, barWidth);
  const downloadLine = `  Download: ${downloadBar} ${formatDuration(timing.download)}`;
  lines.push(downloadLine);

  // Separator
  lines.push(`  ${'─'.repeat(barWidth + 20)}`);

  // Total
  const totalLine = `  Total:    ${' '.repeat(barWidth)} ${bold(formatDuration(timing.total), useColors)}`;
  lines.push(totalLine);

  // Optional DNS/TCP/TLS breakdown if available
  if (timing.dns !== undefined || timing.tcp !== undefined || timing.tls !== undefined) {
    lines.push('');
    lines.push(dim('Connection breakdown:', useColors));

    if (timing.dns !== undefined) {
      lines.push(`  DNS:      ${formatDuration(timing.dns)}`);
    }
    if (timing.tcp !== undefined) {
      lines.push(`  TCP:      ${formatDuration(timing.tcp)}`);
    }
    if (timing.tls !== undefined) {
      lines.push(`  TLS:      ${formatDuration(timing.tls)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a compact timing line for inline display
 */
export function formatTraceCompact(timing: TimingInfo): string {
  return `[${formatDuration(timing.total)} total, ${formatDuration(timing.ttfb)} TTFB]`;
}
