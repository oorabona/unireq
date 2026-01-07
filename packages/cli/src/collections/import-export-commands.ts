/**
 * Collection import/export REPL commands
 */

import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { consola } from 'consola';
import { stringify as stringifyYaml } from 'yaml';
import type { Command, CommandHandler } from '../repl/types.js';
import {
  detectConflicts,
  detectFormatFromString,
  type ExportFormat,
  exportToHar,
  exportToPostman,
  type HarArchive,
  importCurlCommand,
  type ImportFormat,
  importHarArchive,
  importInsomniaExport,
  importPostmanCollection,
  type InsomniaExport,
  type MergeStrategy,
  mergeCollections,
  parseHarArchive,
  parseInsomniaExport,
  parsePostmanCollection,
  type PostmanCollection,
} from './import/index.js';
import { COLLECTIONS_FILE_NAME, loadCollections } from './loader.js';
import type { CollectionConfig, CollectionItem } from './types.js';

/**
 * Parsed collection-import command arguments
 */
interface CollectionImportArgs {
  filePath?: string;
  format?: ImportFormat;
  merge: MergeStrategy;
  collectionName?: string;
}

/**
 * Parse collection-import command arguments
 */
function parseCollectionImportArgs(args: string[]): CollectionImportArgs {
  let filePath: string | undefined;
  let format: ImportFormat | undefined;
  let merge: MergeStrategy = 'skip';
  let collectionName: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--format' || arg === '-f') {
      i++;
      const value = args[i];
      if (value === 'postman' || value === 'insomnia' || value === 'har' || value === 'curl') {
        format = value;
      }
    } else if (arg === '--merge' || arg === '-m') {
      i++;
      const value = args[i];
      if (value === 'replace' || value === 'skip' || value === 'rename') {
        merge = value;
      }
    } else if (arg === '--name' || arg === '-n') {
      i++;
      collectionName = args[i];
    } else if (!filePath && !arg?.startsWith('-')) {
      filePath = arg;
    }

    i++;
  }

  return { filePath, format, merge, collectionName };
}

/**
 * Collection import command handler
 * Imports collections from Postman, Insomnia, or HAR files
 */
export const collectionImportHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspace) {
    consola.warn('No workspace loaded.');
    consola.info('Run from a directory with .unireq/ or use a global workspace.');
    return;
  }

  const { filePath, format: explicitFormat, merge, collectionName } = parseCollectionImportArgs(args);

  // Validate file path
  if (!filePath) {
    consola.error('Usage: collection-import <file> [options]');
    consola.info('');
    consola.info('Options:');
    consola.info('  --format, -f <format>  Force format (postman, insomnia, har, curl)');
    consola.info('  --merge, -m <strategy> Merge strategy (replace, skip, rename) [default: skip]');
    consola.info('  --name, -n <name>      Collection name for HAR imports');
    consola.info('');
    consola.info('Examples:');
    consola.info('  collection-import ./postman.json');
    consola.info('  collection-import ./insomnia.json -f insomnia');
    consola.info('  collection-import ./api.har -m replace');
    return;
  }

  try {
    // Read the file
    const content = await readFile(filePath, 'utf-8');

    // Detect format (supports both JSON and cURL text)
    let format: ImportFormat;
    if (explicitFormat) {
      format = explicitFormat;
    } else {
      try {
        const detection = detectFormatFromString(content);
        format = detection.format;
        consola.info(`Detected format: ${format} (${detection.version})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown format';
        consola.error(`Could not detect file format: ${message}`);
        consola.info('Try specifying format with --format option');
        return;
      }
    }

    // For non-cURL formats, parse as JSON
    let data: unknown;
    if (format !== 'curl') {
      try {
        data = JSON.parse(content);
      } catch {
        consola.error('Invalid JSON file');
        return;
      }
    }

    // Import based on format
    let importedItems: CollectionItem[] = [];
    let importedName = collectionName || 'Imported';
    let warnings: string[] = [];

    switch (format) {
      case 'postman': {
        const parsed = parsePostmanCollection(data);
        if (!parsed.success) {
          consola.error('Invalid Postman collection format');
          return;
        }
        // Type assertion safe: Valibot validation passed
        const result = importPostmanCollection(parsed.output as unknown as PostmanCollection);
        importedItems = result.items.map((i) => i.item);
        importedName = collectionName || result.collections[0]?.name || 'Postman Import';
        warnings = result.warnings;
        break;
      }
      case 'insomnia': {
        const parsed = parseInsomniaExport(data);
        if (!parsed.success) {
          consola.error('Invalid Insomnia export format');
          return;
        }
        // Type assertion safe: Valibot validation passed
        const result = importInsomniaExport(parsed.output as unknown as InsomniaExport);
        importedItems = result.items.map((i) => i.item);
        importedName = collectionName || result.collections[0]?.name || 'Insomnia Import';
        warnings = result.warnings;
        break;
      }
      case 'har': {
        const parsed = parseHarArchive(data);
        if (!parsed.success) {
          consola.error('Invalid HAR archive format');
          return;
        }
        // Type assertion safe: Valibot validation passed
        const result = importHarArchive(parsed.output as unknown as HarArchive, { collectionName: importedName });
        importedItems = result.items.map((i) => i.item);
        importedName = collectionName || result.collections[0]?.name || 'HAR Import';
        warnings = result.warnings;
        break;
      }
      case 'curl': {
        const result = importCurlCommand(content, { collectionName: importedName });
        importedItems = result.items.map((i) => i.item);
        importedName = collectionName || result.collections[0]?.name || 'cURL Import';
        warnings = result.warnings;
        break;
      }
    }

    // Show import warnings
    for (const warning of warnings) {
      consola.warn(warning);
    }

    // Load existing collections
    let existingConfig: CollectionConfig;
    try {
      existingConfig = await loadCollections(state.workspace);
    } catch {
      // No existing collections, create new config
      existingConfig = { version: 1, collections: [] };
    }

    // Create collection ID from name
    const collectionId = importedName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Find or create the target collection
    let targetCollection = existingConfig.collections.find((c) => c.id === collectionId);
    let isNewCollection = false;

    if (!targetCollection) {
      targetCollection = { id: collectionId, name: importedName, items: [] };
      isNewCollection = true;
    }

    // Check for conflicts
    const conflicts = detectConflicts(targetCollection, importedItems);

    if (conflicts.length > 0) {
      consola.info(`Found ${conflicts.length} conflicting item(s), using '${merge}' strategy`);
    }

    // Merge items
    const mergeResult = await mergeCollections(targetCollection, importedItems, { strategy: merge });

    // Update or add collection
    if (isNewCollection) {
      existingConfig.collections.push({
        id: collectionId,
        name: importedName,
        items: mergeResult.collection.items,
      });
    } else {
      const idx = existingConfig.collections.findIndex((c) => c.id === collectionId);
      if (idx >= 0) {
        const existingCollection = existingConfig.collections[idx];
        if (existingCollection) {
          existingCollection.items = mergeResult.collection.items;
        }
      }
    }

    // Write collections.yaml
    const filePath2 = join(state.workspace, COLLECTIONS_FILE_NAME);
    const yaml = stringifyYaml(existingConfig, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(filePath2, yaml, 'utf-8');

    // Report results
    consola.success(`Imported ${mergeResult.added} item(s) to collection '${collectionId}'`);
    if (mergeResult.replaced > 0) {
      consola.info(`Replaced: ${mergeResult.replaced}`);
    }
    if (mergeResult.skipped > 0) {
      consola.info(`Skipped: ${mergeResult.skipped}`);
    }
    if (mergeResult.renamed > 0) {
      consola.info(`Renamed: ${mergeResult.renamed}`);
    }
  } catch (error) {
    consola.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Parsed collection-export command arguments
 */
interface CollectionExportArgs {
  outputPath?: string;
  format?: ExportFormat;
  collection?: string;
}

/**
 * Parse collection-export command arguments
 */
function parseCollectionExportArgs(args: string[]): CollectionExportArgs {
  let outputPath: string | undefined;
  let format: ExportFormat | undefined;
  let collection: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--format' || arg === '-f') {
      i++;
      const value = args[i];
      if (value === 'postman' || value === 'har') {
        format = value;
      }
    } else if (arg === '--collection' || arg === '-c') {
      i++;
      collection = args[i];
    } else if (!outputPath && !arg?.startsWith('-')) {
      outputPath = arg;
    }

    i++;
  }

  // Infer format from extension if not specified
  if (!format && outputPath) {
    const ext = extname(outputPath).toLowerCase();
    if (ext === '.har') {
      format = 'har';
    } else if (ext === '.json') {
      format = 'postman'; // Default JSON to Postman
    }
  }

  return { outputPath, format, collection };
}

/**
 * Collection export command handler
 * Exports collections to Postman or HAR format
 */
export const collectionExportHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspace) {
    consola.warn('No workspace loaded.');
    consola.info('Run from a directory with .unireq/ or use a global workspace.');
    return;
  }

  const { outputPath, format, collection: collectionFilter } = parseCollectionExportArgs(args);

  // Validate output path
  if (!outputPath) {
    consola.error('Usage: collection-export <output-file> [options]');
    consola.info('');
    consola.info('Options:');
    consola.info('  --format, -f <format>     Output format (postman, har) [default: postman]');
    consola.info('  --collection, -c <id>     Export specific collection only');
    consola.info('');
    consola.info('Examples:');
    consola.info('  collection-export ./export.json');
    consola.info('  collection-export ./api.har -f har');
    consola.info('  collection-export ./smoke.json -c smoke');
    return;
  }

  try {
    // Load collections
    const config = await loadCollections(state.workspace);

    if (config.collections.length === 0) {
      consola.warn('No collections to export');
      return;
    }

    // Filter collections if specified
    let collectionsToExport = config.collections;
    if (collectionFilter) {
      collectionsToExport = config.collections.filter((c) => c.id === collectionFilter);
      if (collectionsToExport.length === 0) {
        consola.error(`Collection '${collectionFilter}' not found`);
        return;
      }
    }

    // Export based on format
    const exportFormat = format || 'postman';
    let result: { data: unknown; warnings: string[]; stats: { totalItems: number; exportedItems: number } };

    switch (exportFormat) {
      case 'postman': {
        result = exportToPostman(collectionsToExport);
        break;
      }
      case 'har': {
        result = exportToHar(collectionsToExport);
        break;
      }
      default: {
        consola.error(`Unknown export format: ${exportFormat}`);
        return;
      }
    }

    // Show warnings
    for (const warning of result.warnings) {
      consola.warn(warning);
    }

    // Write output file
    const jsonOutput = JSON.stringify(result.data, null, 2);
    await writeFile(outputPath, jsonOutput, 'utf-8');

    consola.success(`Exported ${result.stats.exportedItems} item(s) to ${outputPath}`);
    consola.info(`Format: ${exportFormat}`);
  } catch (error) {
    consola.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Create collection-import command
 */
export function createCollectionImportCommand(): Command {
  return {
    name: 'collection-import',
    description: 'Import collections from Postman, Insomnia, HAR, or cURL',
    handler: collectionImportHandler,
    helpText: `Usage: collection-import <file> [options]

Import requests from external formats into your collections.

Supported formats:
  - Postman Collection v2.1 (.json)
  - Insomnia v4 Export (.json)
  - HAR 1.2 (.har)
  - cURL commands (.sh, .txt, or any text file)

Options:
  --format, -f <format>   Force format detection (postman, insomnia, har, curl)
  --merge, -m <strategy>  How to handle conflicts (replace, skip, rename)
                          Default: skip
  --name, -n <name>       Collection name (required for HAR/cURL, optional for others)

Merge strategies:
  replace - Overwrite existing items with same ID
  skip    - Keep existing items, ignore imported duplicates
  rename  - Rename imported items with numeric suffix

Examples:
  collection-import ./postman.json
  collection-import ./insomnia.json -f insomnia
  collection-import ./api.har -n "API Tests" -m replace
  collection-import ./curl.sh -n "API Requests"
  collection-import ./export.json --merge rename

Variable conversion:
  - Postman: {{var}} → \${var}
  - Insomnia: {{var}} and _.var → \${var}
  - HAR: Variables not supported (literal values)
  - cURL: Variables preserved as-is (\${var}, {{var}})

cURL support:
  - Parses curl commands with common flags
  - Supports: -X, -H, -d, --data-raw, -F, -u, -A, -e, -b
  - Basic auth (-u) converted to Authorization header
  - Form data and file uploads generate warnings`,
  };
}

/**
 * Create collection-export command
 */
export function createCollectionExportCommand(): Command {
  return {
    name: 'collection-export',
    description: 'Export collections to Postman or HAR format',
    handler: collectionExportHandler,
    helpText: `Usage: collection-export <output-file> [options]

Export your collections to external formats.

Supported formats:
  - Postman Collection v2.1 (.json)
  - HAR 1.2 (.har)

Options:
  --format, -f <format>     Output format (postman, har)
                            Default: postman (or inferred from extension)
  --collection, -c <id>     Export specific collection only

Examples:
  collection-export ./export.json
  collection-export ./api.har -f har
  collection-export ./smoke-tests.json -c smoke

Variable conversion:
  - Postman: \${var} → {{var}}
  - HAR: \${var} → :var (placeholder)

Notes:
  - HAR format does not support variables natively
  - Multiple collections are exported as folders in Postman format
  - HAR entries are flat (no folder structure)`,
  };
}
