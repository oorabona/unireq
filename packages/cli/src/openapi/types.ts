/**
 * OpenAPI Spec Loader Types
 * @module openapi/types
 */

/**
 * Simplified version classification
 */
export type SpecVersion = '2.0' | '3.0' | '3.1';

/**
 * Loaded and parsed OpenAPI specification
 */
export interface LoadedSpec {
  /** Simplified version (2.0, 3.0, 3.1) */
  version: SpecVersion;
  /** Full version string (e.g., "3.1.0", "3.0.3", "2.0") */
  versionFull: string;
  /** Source path or URL where spec was loaded from */
  source: string;
  /** Dereferenced OpenAPI document */
  document: OpenAPIDocument;
}

/**
 * Options for loading specs
 */
export interface LoadOptions {
  /** Timeout for URL fetches in milliseconds (default: 30000) */
  timeout?: number;
  /** Allow HTTP (not HTTPS) for localhost URLs (default: true) */
  allowInsecureLocalhost?: boolean;
}

/**
 * Default load options
 */
export const DEFAULT_LOAD_OPTIONS: Required<LoadOptions> = {
  timeout: 30000,
  allowInsecureLocalhost: true,
};

/**
 * OpenAPI Info object
 */
export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

/**
 * OpenAPI Server object
 */
export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<
    string,
    {
      enum?: string[];
      default: string;
      description?: string;
    }
  >;
}

/**
 * OpenAPI Path Item object (simplified)
 */
export interface OpenAPIPathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  servers?: OpenAPIServer[];
  parameters?: OpenAPIParameter[];
}

/**
 * OpenAPI Operation object (simplified)
 */
export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  servers?: OpenAPIServer[];
}

/**
 * OpenAPI Parameter object (simplified)
 */
export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
}

/**
 * OpenAPI Request Body object (simplified)
 */
export interface OpenAPIRequestBody {
  description?: string;
  content?: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

/**
 * OpenAPI Response object (simplified)
 */
export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
}

/**
 * OpenAPI Header object (simplified)
 */
export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
}

/**
 * OpenAPI Media Type object (simplified)
 */
export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, unknown>;
}

/**
 * OpenAPI Schema object (simplified - JSON Schema subset)
 */
export interface OpenAPISchema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  // Object properties
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: boolean | OpenAPISchema;
  // Array properties
  items?: OpenAPISchema | OpenAPISchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // String properties
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Number properties
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  // Composition
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  // Reference
  $ref?: string;
}

/**
 * OpenAPI Components object (simplified)
 */
export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

/**
 * OpenAPI Security Scheme object (simplified)
 */
export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
}

/**
 * OpenAPI Tag object
 */
export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: {
    description?: string;
    url: string;
  };
}

/**
 * OpenAPI Document (3.x format)
 */
export interface OpenAPIDocument {
  /** OpenAPI version (3.x) or undefined for Swagger 2.0 */
  openapi?: string;
  /** Swagger version (2.0) */
  swagger?: string;
  /** API metadata */
  info: OpenAPIInfo;
  /** Server definitions */
  servers?: OpenAPIServer[];
  /** API paths */
  paths?: Record<string, OpenAPIPathItem>;
  /** Reusable components */
  components?: OpenAPIComponents;
  /** Security requirements */
  security?: Array<Record<string, string[]>>;
  /** Tags for organization */
  tags?: OpenAPITag[];
  /** External documentation */
  externalDocs?: {
    description?: string;
    url: string;
  };
  // Swagger 2.0 specific fields
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  definitions?: Record<string, OpenAPISchema>;
  securityDefinitions?: Record<string, OpenAPISecurityScheme>;
}
