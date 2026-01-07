/**
 * HTTP Proxy support for unireq
 * Supports HTTP, HTTPS, and SOCKS proxies
 */

import type { Policy, RequestContext } from '@unireq/core';

/**
 * Proxy authentication credentials
 */
export interface ProxyAuth {
  readonly username: string;
  readonly password: string;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  /**
   * Proxy URL (e.g., 'http://proxy.example.com:8080')
   */
  readonly url: string;

  /**
   * Proxy authentication credentials
   */
  readonly auth?: ProxyAuth;

  /**
   * List of hosts to bypass proxy (supports wildcards)
   * @example ['localhost', '*.internal.com', '10.*']
   */
  readonly noProxy?: ReadonlyArray<string>;

  /**
   * Proxy protocol (auto-detected from URL if not specified)
   */
  readonly protocol?: 'http' | 'https' | 'socks4' | 'socks5';
}

/**
 * Environment variable names for proxy configuration
 */
const PROXY_ENV_VARS = {
  http: ['HTTP_PROXY', 'http_proxy'],
  https: ['HTTPS_PROXY', 'https_proxy'],
  noProxy: ['NO_PROXY', 'no_proxy'],
} as const;

/**
 * Parse proxy URL to extract components
 */
function parseProxyUrl(url: string): { host: string; port: number; protocol: string; auth?: ProxyAuth } {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(':', '');
    const defaultPort = protocol === 'https' ? 443 : 8080;
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;

    let auth: ProxyAuth | undefined;
    if (parsed.username && parsed.password) {
      auth = {
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
    }

    return {
      host: parsed.hostname,
      port,
      protocol,
      auth,
    };
  } catch {
    throw new Error(`Invalid proxy URL: ${url}`);
  }
}

/**
 * Check if a host should bypass the proxy
 */
function shouldBypassProxy(host: string, noProxy: ReadonlyArray<string>): boolean {
  const normalizedHost = host.toLowerCase();

  for (const pattern of noProxy) {
    const normalizedPattern = pattern.toLowerCase().trim();

    // Empty pattern
    if (!normalizedPattern) {
      continue;
    }

    // Wildcard match all
    if (normalizedPattern === '*') {
      return true;
    }

    // Exact match
    if (normalizedHost === normalizedPattern) {
      return true;
    }

    // Wildcard prefix match (e.g., *.example.com)
    if (normalizedPattern.startsWith('*.')) {
      const suffix = normalizedPattern.slice(1); // .example.com
      /* v8 ignore next -- @preserve exact match branch (*.example.com matches example.com) tested separately */
      if (normalizedHost.endsWith(suffix) || normalizedHost === normalizedPattern.slice(2)) {
        return true;
      }
    }

    // Suffix match (e.g., .example.com matches sub.example.com)
    if (normalizedPattern.startsWith('.')) {
      /* v8 ignore next -- @preserve exact match branch (.example.com matches example.com) tested separately */
      if (normalizedHost.endsWith(normalizedPattern) || normalizedHost === normalizedPattern.slice(1)) {
        return true;
      }
    }

    // IP range prefix match (e.g., 10.* matches 10.0.0.1)
    if (normalizedPattern.endsWith('.*')) {
      const prefix = normalizedPattern.slice(0, -1); // 10.
      /* v8 ignore next -- @preserve IP prefix match tested via 10.* pattern */
      if (normalizedHost.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get proxy configuration from environment variables
 */
function getProxyFromEnv(targetUrl: string): ProxyConfig | null {
  const parsed = new URL(targetUrl);
  const protocol = parsed.protocol.replace(':', '') as 'http' | 'https';

  // Check NO_PROXY first
  const noProxyEnv = PROXY_ENV_VARS.noProxy.map((v) => process.env[v]).find(Boolean);
  const noProxy = noProxyEnv ? noProxyEnv.split(',').map((h) => h.trim()) : [];

  // Check if target should bypass proxy
  if (shouldBypassProxy(parsed.hostname, noProxy)) {
    return null;
  }

  // Get proxy URL from environment
  const proxyEnvVars = protocol === 'https' ? PROXY_ENV_VARS.https : PROXY_ENV_VARS.http;
  const proxyUrl = proxyEnvVars.map((v) => process.env[v]).find(Boolean);

  if (!proxyUrl) {
    return null;
  }

  return {
    url: proxyUrl,
    noProxy,
  };
}

/**
 * Create a proxy policy
 *
 * @param config - Proxy URL string or configuration object
 * @returns Policy that routes requests through the proxy
 *
 * @example
 * ```ts
 * // Simple proxy URL
 * const api = client(
 *   http('https://api.example.com'),
 *   proxy('http://proxy.corp.com:8080')
 * );
 *
 * // With authentication
 * const api = client(
 *   http('https://api.example.com'),
 *   proxy({
 *     url: 'http://proxy.corp.com:8080',
 *     auth: { username: 'user', password: 'pass' },
 *   })
 * );
 *
 * // With bypass list
 * const api = client(
 *   http('https://api.example.com'),
 *   proxy({
 *     url: 'http://proxy.corp.com:8080',
 *     noProxy: ['localhost', '*.internal.com', '10.*'],
 *   })
 * );
 * ```
 */
export function proxy(config: string | ProxyConfig): Policy {
  const proxyConfig: ProxyConfig = typeof config === 'string' ? { url: config } : config;

  const { url: proxyUrl, auth, noProxy = [] } = proxyConfig;
  const parsedProxy = parseProxyUrl(proxyUrl);

  // Merge auth from URL and config (config takes precedence)
  const proxyAuth = auth ?? parsedProxy.auth;

  return async (ctx: RequestContext, next) => {
    // Check if request should bypass proxy
    const targetUrl = new URL(ctx.url);
    if (shouldBypassProxy(targetUrl.hostname, noProxy)) {
      return next(ctx);
    }

    // Add proxy headers
    const headers = { ...ctx.headers };

    // Add Proxy-Authorization header if auth is provided
    if (proxyAuth) {
      const credentials = `${proxyAuth.username}:${proxyAuth.password}`;
      const encoded = Buffer.from(credentials).toString('base64');
      headers['proxy-authorization'] = `Basic ${encoded}`;
    }

    // Add proxy configuration to context for transport to use
    const enrichedCtx: RequestContext = {
      ...ctx,
      headers,
      proxy: {
        host: parsedProxy.host,
        port: parsedProxy.port,
        protocol: parsedProxy.protocol,
        auth: proxyAuth,
      },
    };

    return next(enrichedCtx);
  };
}

/**
 * Create a proxy policy from environment variables
 *
 * Reads from:
 * - HTTP_PROXY / http_proxy
 * - HTTPS_PROXY / https_proxy
 * - NO_PROXY / no_proxy
 *
 * @returns Policy that routes requests through environment-configured proxy
 *
 * @example
 * ```ts
 * // Use environment variables
 * const api = client(
 *   http('https://api.example.com'),
 *   proxy.fromEnv()
 * );
 * ```
 */
proxy.fromEnv = function fromEnv(): Policy {
  return async (ctx: RequestContext, next) => {
    const envConfig = getProxyFromEnv(ctx.url);

    if (!envConfig) {
      return next(ctx);
    }

    const proxyPolicy = proxy(envConfig);
    return proxyPolicy(ctx, next);
  };
};

/**
 * Proxy namespace
 */
export const proxyPolicy = {
  proxy,
  fromEnv: proxy.fromEnv,
};
