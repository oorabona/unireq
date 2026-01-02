/**
 * HTTP command parser for REPL
 * Re-exports shared parser functions for backward compatibility
 */

export {
  generateHttpOptionsHelp,
  HTTP_METHODS,
  isHttpMethod,
  parseHttpCommand,
} from '../shared/http-options.js';

/**
 * Get list of supported HTTP methods for help/error messages
 */
export function getSupportedMethods(): string[] {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
}
