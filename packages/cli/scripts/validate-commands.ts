#!/usr/bin/env tsx
/**
 * Validate command consistency between documentation and implementation
 *
 * Detects:
 * - Commands documented in help but not implemented
 * - Commands implemented but not documented in help
 * - Subcommands defined in handlers but not in help
 * - Shell commands not matching REPL commands
 *
 * Usage: pnpm validate:commands
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry } from '../src/repl/commands.js';
import { REPL_COMMANDS } from '../src/repl/help.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(__dirname, '../src');

interface ValidationResult {
  category: string;
  issues: string[];
  warnings: string[];
  info: string[];
}

const results: ValidationResult[] = [];

/**
 * Extract subcommands from a handler file by parsing the source
 * Only matches explicit subcommand checks, not arbitrary strings
 */
function extractSubcommandsFromSource(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const subcommands: string[] = [];

    // Pattern 1: if (subcommand === 'xxx') - captures the value
    const ifMatches = content.matchAll(/if\s*\(\s*subcommand\s*===?\s*['"]([a-z_-]+)['"]\s*\)/gi);
    for (const match of ifMatches) {
      if (match[1]) subcommands.push(match[1].toLowerCase());
    }

    // Pattern 2: subcommand === 'xxx' || subcommand === 'yyy' (for aliases)
    const orMatches = content.matchAll(/subcommand\s*===?\s*['"]([a-z_-]+)['"]/gi);
    for (const match of orMatches) {
      if (match[1]) subcommands.push(match[1].toLowerCase());
    }

    // Pattern 3: case 'xxx': in switch statements
    const caseMatches = content.matchAll(/case\s+['"]([a-z_-]+)['"]\s*:/gi);
    for (const match of caseMatches) {
      if (match[1]) subcommands.push(match[1].toLowerCase());
    }

    // Filter out common false positives
    const filtered = subcommands.filter((s) => !['true', 'false', 'yes', 'no', 'on', 'off', 'auto', 'vault', 'keychain'].includes(s));

    return [...new Set(filtered)];
  } catch {
    return [];
  }
}

/**
 * Extract subcommands mentioned in help text (Subcommands: section only)
 */
function extractSubcommandsFromHelp(helpText: string, commandName: string): string[] {
  const subcommands: string[] = [];

  // Only look in Subcommands: section
  // Use \n to only consume the newline after "Subcommands:", preserving leading spaces in content
  const subcommandsSection = helpText.match(/Subcommands?:\n([\s\S]*?)(?:\n\n|Examples?:|Options?:|$)/i);
  if (subcommandsSection?.[1]) {
    const lines = subcommandsSection[1].split('\n');
    for (const line of lines) {
      // Match "  command subcommand" pattern - the help text shows full command like "workspace list"
      // We need to extract just the subcommand part
      // Subcommand must be lowercase (descriptions start with capitals)
      // Pattern: 2+ spaces, command, 1 space, lowercase subcommand, then space or end
      const cmdPattern = new RegExp(`^\\s{2,}${commandName}\\s([a-z][a-z_-]*)(?:\\s|$)`);
      const match = line.match(cmdPattern);
      if (match?.[1]) {
        subcommands.push(match[1].toLowerCase());
      }
    }
  }

  return [...new Set(subcommands)];
}

/**
 * Map command names to their handler source files
 */
const COMMAND_SOURCE_FILES: Record<string, string> = {
  workspace: 'workspace/commands.ts',
  profile: 'workspace/profiles/commands.ts',
  secret: 'secrets/commands.ts',
  auth: 'auth/commands.ts',
  defaults: 'workspace/defaults/commands.ts',
  history: 'collections/commands.ts',
};

/**
 * Known subcommand aliases (don't warn for these)
 */
const KNOWN_ALIASES: Record<string, string[]> = {
  workspace: ['ls', 'rm', 'switch', 'check', 'add', 'remove'], // aliases for list, unregister, use, doctor, register
  profile: ['rm', 'config', 'baseurl', 'url', 'timeout', 'timeoutms', 'verifytls', 'tls', 'header', 'var', 'variable'],
  secret: ['rm'],
  auth: ['ls'],
};

/**
 * Shell commands defined in main.ts
 */
const SHELL_COMMANDS = [
  'repl',
  'request',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'workspace',
  'profile',
  'defaults',
  'secret',
];

/**
 * Commands that are REPL-only (not available in shell)
 */
const REPL_ONLY_COMMANDS = ['cd', 'ls', 'pwd', 'describe', 'import', 'run', 'save', 'extract', 'vars', 'auth', 'help', 'exit', 'version', 'history'];

// ============================================================================
// Validation 1: REPL Commands - Documented vs Implemented
// ============================================================================

function validateReplCommands(): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Get documented commands
  const documentedCommands = new Set(REPL_COMMANDS.map((c) => c.name));

  // Get implemented commands from registry
  const registry = createDefaultRegistry();
  const implementedCommands = new Set(registry.getAll().map((c) => c.name));

  // Check for documented but not implemented
  for (const cmd of documentedCommands) {
    if (!implementedCommands.has(cmd)) {
      issues.push(`❌ DOCUMENTED but NOT IMPLEMENTED: "${cmd}"`);
    }
  }

  // Check for implemented but not documented
  for (const cmd of implementedCommands) {
    if (!documentedCommands.has(cmd)) {
      issues.push(`❌ IMPLEMENTED but NOT DOCUMENTED: "${cmd}"`);
    }
  }

  // Info about helpText locations (not an issue, just informational)
  let helpInBoth = 0;
  let helpOnlyInRepl = 0;
  let helpOnlyInRegistry = 0;

  for (const cmd of registry.getAll()) {
    const documented = REPL_COMMANDS.find((c) => c.name === cmd.name);
    if (documented) {
      if (cmd.helpText && documented.helpText) helpInBoth++;
      else if (documented.helpText && !cmd.helpText) helpOnlyInRepl++;
      else if (cmd.helpText && !documented.helpText) helpOnlyInRegistry++;
    }
  }

  info.push(`ℹ️  helpText: ${helpInBoth} in both, ${helpOnlyInRepl} only in REPL_COMMANDS, ${helpOnlyInRegistry} only in registry`);

  return { category: 'REPL Commands', issues, warnings, info };
}

// ============================================================================
// Validation 2: Subcommands - Help vs Implementation
// ============================================================================

function validateSubcommands(): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  for (const [cmdName, sourceFile] of Object.entries(COMMAND_SOURCE_FILES)) {
    const fullPath = join(SRC_PATH, sourceFile);

    // Get subcommands from source code
    const implementedSubs = extractSubcommandsFromSource(fullPath);

    // Get subcommands from help text
    const helpEntry = REPL_COMMANDS.find((c) => c.name === cmdName);
    const documentedSubs = helpEntry?.helpText ? extractSubcommandsFromHelp(helpEntry.helpText, cmdName) : [];

    // Get known aliases for this command
    const aliases = KNOWN_ALIASES[cmdName] || [];

    // Compare
    const implSet = new Set(implementedSubs);
    const docSet = new Set(documentedSubs);

    // Implemented but not documented (excluding aliases)
    const undocumented: string[] = [];
    for (const sub of implSet) {
      if (!docSet.has(sub) && !aliases.includes(sub)) {
        undocumented.push(sub);
      }
    }
    if (undocumented.length > 0) {
      warnings.push(`⚠️  "${cmdName}" - undocumented subcommands: ${undocumented.join(', ')}`);
    }

    // Documented but not implemented
    for (const sub of docSet) {
      if (!implSet.has(sub)) {
        issues.push(`❌ "${cmdName} ${sub}" - documented but not found in implementation`);
      }
    }

    info.push(`ℹ️  "${cmdName}": ${implSet.size} implemented, ${docSet.size} documented`);
  }

  return { category: 'Subcommands', issues, warnings, info };
}

// ============================================================================
// Validation 3: Shell vs REPL Commands
// ============================================================================

function validateShellCommands(): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  const documentedCommands = new Set(REPL_COMMANDS.map((c) => c.name));

  // Check shell commands that should have REPL equivalents
  for (const shellCmd of SHELL_COMMANDS) {
    if (shellCmd === 'repl' || shellCmd === 'request') continue; // Special shell-only commands

    if (!documentedCommands.has(shellCmd)) {
      issues.push(`❌ Shell command "${shellCmd}" has no REPL documentation`);
    }
  }

  // Check REPL commands that should have shell equivalents (informational only)
  const replOnlyCount = REPL_ONLY_COMMANDS.length;
  const bothCount = REPL_COMMANDS.filter((c) => SHELL_COMMANDS.includes(c.name)).length;

  info.push(`ℹ️  ${bothCount} commands available in both shell and REPL`);
  info.push(`ℹ️  ${replOnlyCount} commands are REPL-only by design`);

  return { category: 'Shell vs REPL', issues, warnings, info };
}

// ============================================================================
// Validation 4: Help text quality
// ============================================================================

function validateHelpTextQuality(): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  let withHelp = 0;
  let withUsage = 0;
  let withExamples = 0;

  for (const cmd of REPL_COMMANDS) {
    if (cmd.helpText) {
      withHelp++;
      if (cmd.helpText.includes('Usage:')) withUsage++;
      if (cmd.helpText.toLowerCase().includes('example')) withExamples++;
    }

    // Commands with subcommands should have detailed help
    if (['workspace', 'profile', 'secret', 'auth', 'defaults', 'history'].includes(cmd.name)) {
      if (!cmd.helpText) {
        issues.push(`❌ "${cmd.name}" should have helpText (has subcommands)`);
      } else if (!cmd.helpText.toLowerCase().includes('subcommand')) {
        warnings.push(`⚠️  "${cmd.name}" helpText should document subcommands`);
      }
    }

    // HTTP commands should have options documented
    if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(cmd.name)) {
      if (!cmd.helpText) {
        issues.push(`❌ "${cmd.name}" should have helpText (HTTP command)`);
      }
    }
  }

  info.push(`ℹ️  ${withHelp}/${REPL_COMMANDS.length} commands have helpText`);
  info.push(`ℹ️  ${withUsage}/${withHelp} helpTexts include Usage:`);
  info.push(`ℹ️  ${withExamples}/${withHelp} helpTexts include examples`);

  return { category: 'Help Text Quality', issues, warnings, info };
}

// ============================================================================
// Run all validations
// ============================================================================

console.log('🔍 Validating command consistency...\n');

results.push(validateReplCommands());
results.push(validateSubcommands());
results.push(validateShellCommands());
results.push(validateHelpTextQuality());

// Print results
let hasErrors = false;
let hasWarnings = false;

for (const result of results) {
  console.log(`\n━━━ ${result.category} ━━━`);

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log('✅ All checks passed');
  }

  for (const issue of result.issues) {
    console.log(issue);
    hasErrors = true;
  }
  for (const warning of result.warnings) {
    console.log(warning);
    hasWarnings = true;
  }
  for (const inf of result.info) {
    console.log(inf);
  }
}

// Summary
console.log('\n━━━ Summary ━━━');
const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

if (totalIssues === 0 && totalWarnings === 0) {
  console.log('✅ All validations passed!');
} else if (totalIssues === 0) {
  console.log(`✅ No errors, ${totalWarnings} warning(s) to review`);
} else {
  console.log(`❌ Found ${totalIssues} error(s) and ${totalWarnings} warning(s)`);
}

// Exit with error code if there are issues
if (hasErrors) {
  process.exit(1);
}
