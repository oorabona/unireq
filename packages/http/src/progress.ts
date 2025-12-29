/**
 * Progress tracking for uploads and downloads
 * Provides callbacks for monitoring request/response progress
 */

import type { Policy, RequestContext } from '@unireq/core';

/**
 * Progress event data
 */
export interface ProgressEvent {
  /**
   * Bytes transferred so far
   */
  readonly loaded: number;

  /**
   * Total bytes to transfer (if known)
   */
  readonly total: number | undefined;

  /**
   * Progress percentage (0-100, if total is known)
   */
  readonly percent: number | undefined;

  /**
   * Transfer rate in bytes per second
   */
  readonly rate: number;

  /**
   * Estimated time remaining in seconds (if total is known)
   */
  readonly eta: number | undefined;
}

/**
 * Progress callback function
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress tracking options
 */
export interface ProgressOptions {
  /**
   * Callback for upload progress
   */
  readonly onUploadProgress?: ProgressCallback;

  /**
   * Callback for download progress
   */
  readonly onDownloadProgress?: ProgressCallback;

  /**
   * Minimum interval between progress updates (ms)
   * @default 100
   */
  readonly throttle?: number;
}

/**
 * Create progress event from tracking state
 */
function createProgressEvent(loaded: number, total: number | undefined, startTime: number): ProgressEvent {
  const elapsed = (Date.now() - startTime) / 1000; // seconds
  const rate = elapsed > 0 ? loaded / elapsed : 0;
  const percent = total !== undefined && total > 0 ? Math.round((loaded / total) * 100) : undefined;
  const remaining = total !== undefined ? total - loaded : undefined;
  const eta = remaining !== undefined && rate > 0 ? remaining / rate : undefined;

  return {
    loaded,
    total,
    percent,
    rate: Math.round(rate),
    eta: eta !== undefined ? Math.round(eta) : undefined,
  };
}

/**
 * Create throttled callback
 */
function throttleCallback(callback: ProgressCallback, interval: number): ProgressCallback {
  let lastCall = 0;

  return (event: ProgressEvent) => {
    const now = Date.now();

    if (now - lastCall >= interval) {
      lastCall = now;
      callback(event);
    }
  };
}

/**
 * Wrap a readable stream to track progress
 */
function wrapStreamForProgress(
  stream: ReadableStream<Uint8Array>,
  total: number | undefined,
  callback: ProgressCallback,
  throttle: number,
): ReadableStream<Uint8Array> {
  const startTime = Date.now();
  let loaded = 0;
  const throttledCallback = throttleCallback(callback, throttle);
  const reader = stream.getReader();

  return new ReadableStream<Uint8Array>({
    async start() {
      // Initial progress event
      throttledCallback(createProgressEvent(0, total, startTime));
    },

    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Final progress event with actual loaded amount
          callback(createProgressEvent(loaded, total, startTime));
          controller.close();
          return;
        }

        loaded += value.length;
        throttledCallback(createProgressEvent(loaded, total, startTime));
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },

    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Create a progress tracking policy
 *
 * Provides callbacks for monitoring upload and download progress.
 *
 * @param options - Progress tracking options
 * @returns Policy that tracks request/response progress
 *
 * @example
 * ```ts
 * import { client } from '@unireq/core';
 * import { http, progress } from '@unireq/http';
 *
 * const api = client(http('https://api.example.com'));
 *
 * // Upload progress
 * const response = await api.post('/upload', formData, progress({
 *   onUploadProgress: ({ loaded, total, percent, rate, eta }) => {
 *     console.log(`Upload: ${percent}% (${rate} bytes/sec, ETA: ${eta}s)`);
 *   },
 * }));
 *
 * // Download progress
 * const response = await api.get('/download/large-file', progress({
 *   onDownloadProgress: ({ loaded, total, percent }) => {
 *     progressBar.update(percent);
 *   },
 * }));
 * ```
 */
export function progress(options: ProgressOptions): Policy {
  const { onUploadProgress, onDownloadProgress, throttle = 100 } = options;

  return async (ctx: RequestContext, next) => {
    let uploadTrackedCtx = ctx;

    // Track upload progress if callback provided
    if (onUploadProgress && ctx.body) {
      const body = ctx.body;

      // Get content length if available
      let contentLength: number | undefined;
      const contentLengthHeader = ctx.headers['content-length'];
      if (contentLengthHeader) {
        contentLength = Number.parseInt(contentLengthHeader, 10);
        if (Number.isNaN(contentLength)) {
          contentLength = undefined;
        }
      }

      // Wrap body stream for progress tracking
      if (body && typeof body === 'object' && 'getReader' in body) {
        const wrappedStream = wrapStreamForProgress(
          body as ReadableStream<Uint8Array>,
          contentLength,
          onUploadProgress,
          throttle,
        );

        uploadTrackedCtx = {
          ...ctx,
          body: wrappedStream,
        };
      } else if (body instanceof Blob) {
        const stream = body.stream();
        const wrappedStream = wrapStreamForProgress(stream, body.size, onUploadProgress, throttle);

        uploadTrackedCtx = {
          ...ctx,
          body: wrappedStream,
        };
      } else if (typeof body === 'string') {
        // For string bodies, emit progress immediately
        const bytes = new TextEncoder().encode(body).length;
        onUploadProgress(createProgressEvent(bytes, bytes, Date.now()));
      } else if (body instanceof ArrayBuffer) {
        onUploadProgress(createProgressEvent(body.byteLength, body.byteLength, Date.now()));
      }
    }

    const response = await next(uploadTrackedCtx);

    // Track download progress if callback provided
    if (onDownloadProgress) {
      const data = response.data;

      // Get content length from response headers
      let contentLength: number | undefined;
      const contentLengthHeader = response.headers['content-length'];
      if (contentLengthHeader) {
        contentLength = Number.parseInt(contentLengthHeader, 10);
        if (Number.isNaN(contentLength)) {
          contentLength = undefined;
        }
      }

      // Wrap response stream for progress tracking
      if (data && typeof data === 'object' && 'getReader' in data) {
        const wrappedStream = wrapStreamForProgress(
          data as ReadableStream<Uint8Array>,
          contentLength,
          onDownloadProgress,
          throttle,
        );

        return {
          ...response,
          data: wrappedStream,
        };
      }

      if (data instanceof Blob) {
        onDownloadProgress(createProgressEvent(data.size, data.size, Date.now()));
      } else if (typeof data === 'string') {
        const bytes = new TextEncoder().encode(data).length;
        onDownloadProgress(createProgressEvent(bytes, bytes, Date.now()));
      } else if (data instanceof ArrayBuffer) {
        onDownloadProgress(createProgressEvent(data.byteLength, data.byteLength, Date.now()));
      }
    }

    return response;
  };
}

/**
 * Progress namespace
 */
export const progressPolicy = {
  progress,
};
