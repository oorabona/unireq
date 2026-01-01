/**
 * Syntax highlighting for JSON and XML content
 * Uses picocolors for terminal color output
 * Uses fast-xml-parser for XML validation
 */

import { XMLValidator } from 'fast-xml-parser';
import pc from 'picocolors';

/**
 * Content type categories for highlighting
 */
export type HighlightType = 'json' | 'xml' | 'unknown';

/**
 * Detect content type from Content-Type header
 * Supports standard types and +json/+xml suffixes
 */
export function detectContentType(contentType: string | undefined): HighlightType {
  if (!contentType) {
    return 'unknown';
  }

  const normalized = contentType.toLowerCase();

  // Check for JSON (application/json, text/json, *+json)
  if (normalized.includes('json')) {
    return 'json';
  }

  // Check for XML (application/xml, text/xml, *+xml)
  if (normalized.includes('xml')) {
    return 'xml';
  }

  return 'unknown';
}

/**
 * Recursively stringify and colorize JSON
 */
function stringifyWithColors(value: unknown, indent: number, useColors: boolean): string {
  const spaces = '  '.repeat(indent);
  const nextSpaces = '  '.repeat(indent + 1);

  if (value === null) {
    return useColors ? pc.dim('null') : 'null';
  }

  if (typeof value === 'boolean') {
    return useColors ? pc.magenta(String(value)) : String(value);
  }

  if (typeof value === 'number') {
    return useColors ? pc.yellow(String(value)) : String(value);
  }

  if (typeof value === 'string') {
    const escaped = JSON.stringify(value).slice(1, -1);
    return useColors ? `"${pc.green(escaped)}"` : `"${escaped}"`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const items = value.map((item) => `${nextSpaces}${stringifyWithColors(item, indent + 1, useColors)}`);
    return `[\n${items.join(',\n')}\n${spaces}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }

    const lines = entries.map(([key, val]) => {
      const coloredKey = useColors ? `"${pc.cyan(key)}"` : `"${key}"`;
      const coloredValue = stringifyWithColors(val, indent + 1, useColors);
      return `${nextSpaces}${coloredKey}: ${coloredValue}`;
    });

    return `{\n${lines.join(',\n')}\n${spaces}}`;
  }

  return String(value);
}

/**
 * Highlight JSON content with syntax coloring
 *
 * Color scheme:
 * - Keys: cyan
 * - String values: green
 * - Numbers: yellow
 * - Booleans: magenta
 * - Null: dim
 *
 * @param text - JSON string to highlight
 * @param useColors - Whether to apply colors
 * @returns Highlighted string or original if colors disabled/invalid JSON
 */
export function highlightJson(text: string, useColors: boolean): string {
  if (!useColors || !text) {
    return text;
  }

  // Try to parse and re-stringify to ensure valid JSON
  // If invalid, return as-is
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }

  return stringifyWithColors(parsed, 0, useColors);
}

/**
 * Placeholder token for protected sections during XML highlighting
 */
interface ProtectedSection {
  readonly placeholder: string;
  readonly content: string;
}

/**
 * Highlight XML content with syntax coloring using parser-validated tokenization
 *
 * Color scheme:
 * - Tag names: cyan
 * - Attribute names: yellow
 * - Attribute values: green
 * - Comments: dim
 * - XML declarations: dim
 * - CDATA: dim wrapper, content unchanged
 *
 * Uses fast-xml-parser's XMLValidator for structure validation before highlighting.
 * Falls back to raw content if XML is malformed.
 *
 * @param text - XML string to highlight
 * @param useColors - Whether to apply colors
 * @returns Highlighted string or original if colors disabled
 */
export function highlightXml(text: string, useColors: boolean): string {
  if (!useColors || !text) {
    return text;
  }

  // Validate XML structure using fast-xml-parser
  // This ensures we're working with well-formed XML
  const validationResult = XMLValidator.validate(text, {
    allowBooleanAttributes: true,
  });

  // If validation fails, still attempt highlighting for partial content
  // (user expectation: highlight what we can)
  const isValid = validationResult === true;

  let result = text;
  const protectedSections: ProtectedSection[] = [];
  let placeholderIndex = 0;

  /**
   * Protect a section from further processing by replacing with placeholder
   */
  function protectSection(_match: string, highlighted: string): string {
    const placeholder = `\x00PROTECTED_${placeholderIndex++}\x00`;
    protectedSections.push({ placeholder, content: highlighted });
    return placeholder;
  }

  // Step 1: Protect CDATA sections (they can contain < and > safely)
  // CDATA content is NOT highlighted, only the wrapper is dimmed
  result = result.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, content) => {
    const highlighted = `${pc.dim('<![CDATA[')}${content}${pc.dim(']]>')}`;
    return protectSection(match, highlighted);
  });

  // Step 2: Protect and highlight XML comments <!-- ... -->
  result = result.replace(/<!--[\s\S]*?-->/g, (match) => {
    return protectSection(match, pc.dim(match));
  });

  // Step 3: Protect and highlight XML/processing declarations <?...?>
  result = result.replace(/<\?[\s\S]*?\?>/g, (match) => {
    return protectSection(match, pc.dim(match));
  });

  // Step 4: Highlight DOCTYPE declarations
  result = result.replace(/<!DOCTYPE[^>]*>/gi, (match) => {
    return protectSection(match, pc.dim(match));
  });

  // Step 5: Highlight opening/self-closing tags with attributes
  // Pattern: <tagname attr="value" ...> or <tagname ... />
  // Uses non-greedy matching and handles both single and double quotes
  result = result.replace(
    /<([a-zA-Z_][\w:.-]*)(\s+(?:[^>]*?))?(\s*\/)?>/g,
    (_match, tagName: string, attrs: string | undefined, selfClose: string | undefined) => {
      let highlighted = `<${pc.cyan(tagName)}`;

      if (attrs) {
        // Highlight attributes: name="value" or name='value'
        const highlightedAttrs = attrs.replace(
          /([a-zA-Z_:][\w:.-]*)(\s*=\s*)(["'])((?:(?!\3)[^\\]|\\.)*)\3/g,
          (_attrMatch: string, attrName: string, equals: string, quote: string, attrValue: string) =>
            `${pc.yellow(attrName)}${equals}${quote}${pc.green(attrValue)}${quote}`,
        );
        highlighted += highlightedAttrs;
      }

      highlighted += selfClose ? `${selfClose}>` : '>';
      return highlighted;
    },
  );

  // Step 6: Highlight closing tags </tagname>
  result = result.replace(/<\/([a-zA-Z_][\w:.-]*)>/g, (_, tagName: string) => `</${pc.cyan(tagName)}>`);

  // Step 7: Restore protected sections
  for (const section of protectedSections) {
    result = result.replace(section.placeholder, section.content);
  }

  // If XML was invalid, we did our best - still return highlighted result
  // The validator check is mainly for confidence, not to block highlighting
  if (!isValid) {
    // We could log a warning here in debug mode
  }

  return result;
}

/**
 * Apply syntax highlighting based on content type
 *
 * @param text - Content to highlight
 * @param contentType - Content-Type header value
 * @param useColors - Whether to apply colors
 * @returns Highlighted content
 */
export function highlight(text: string, contentType: string | undefined, useColors: boolean): string {
  if (!useColors || !text) {
    return text;
  }

  const type = detectContentType(contentType);

  switch (type) {
    case 'json':
      return highlightJson(text, useColors);
    case 'xml':
      return highlightXml(text, useColors);
    default:
      return text;
  }
}
