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

// Placeholder exports - will be populated as features are implemented
export type {} from '@unireq/http';
