/**
 * @unireq/cli - HTTP CLI client with REPL mode
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// Version export for CLI --version (read from package.json)
export const VERSION: string = pkg.version;

// Executor exports for programmatic use
export { detectContentType, executeRequest, parseHeaders, parseQuery } from './executor.js';

// Type exports
export type { GlobalOptions, HttpMethod, ParsedRequest, RequestOptions } from './types.js';
