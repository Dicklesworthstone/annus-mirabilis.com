/**
 * React Server Component (RSC) Client Boundary Gate.
 *
 * Enforces:
 * Any module reachable from `src/app` App Router entry points (pages, layouts, routes, etc.)
 * along an import chain that does NOT cross a `'use client'` boundary is evaluated in Server Component
 * context (RSC), and MUST NOT use React client-only hooks/APIs:
 *   createContext, useContext, useState, useEffect, useRef, useReducer,
 *   useLayoutEffect, useInsertionEffect, useImperativeHandle, useTransition,
 *   useDeferredValue, useSyncExternalStore, useActionState, useOptimistic.
 *
 * Using any of these client hooks in a Server Component without a 'use client' directive
 * is a fatal next-build failure that passes typecheck and isolated test suites.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REACT_CLIENT_HOOKS = [
  "createContext",
  "useContext",
  "useState",
  "useEffect",
  "useRef",
  "useReducer",
  "useLayoutEffect",
  "useInsertionEffect",
  "useImperativeHandle",
  "useTransition",
  "useDeferredValue",
  "useSyncExternalStore",
  "useActionState",
  "useOptimistic",
] as const;

export type ReactClientHook = (typeof REACT_CLIENT_HOOKS)[number];

export interface SourceFileRecord {
  readonly path: string;
  readonly content: string;
}

export interface ClientBoundaryViolation {
  readonly file: string;
  readonly hooks: readonly string[];
  readonly chain: readonly string[];
  readonly message: string;
  readonly repair: string;
}

export function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

/**
 * Checks if a file starts with a 'use client' directive, ignoring leading comments,
 * empty lines, whitespace, and shebang.
 */
export function hasUseClientDirective(content: string): boolean {
  let trimmed = content.replace(/^#![^\n]*\n/, "");
  while (true) {
    trimmed = trimmed.trimStart();
    if (trimmed.startsWith("/*")) {
      const endIdx = trimmed.indexOf("*/");
      if (endIdx === -1) break;
      trimmed = trimmed.slice(endIdx + 2);
    } else if (trimmed.startsWith("//")) {
      const newlineIdx = trimmed.indexOf("\n");
      if (newlineIdx === -1) {
        trimmed = "";
        break;
      }
      trimmed = trimmed.slice(newlineIdx + 1);
    } else {
      break;
    }
  }
  return /^(["'])use client\1;?/m.test(trimmed);
}

/**
 * Strips comments from JavaScript/TypeScript source code while preserving string literals.
 */
export function stripCommentsAndPreserveStrings(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    (match) => {
      if (match.startsWith("/*") || match.startsWith("//")) {
        return " ";
      }
      return match;
    },
  );
}

/**
 * Detects React client-only hook or API usages in a file's content.
 * Checks both named imports from "react" (excluding pure type imports)
 * and React.hook member expressions.
 */
export function detectClientHookUsages(content: string): string[] {
  const code = stripCommentsAndPreserveStrings(content);
  const detected = new Set<string>();

  for (const hook of REACT_CLIENT_HOOKS) {
    // 1. Named import from "react" or 'react'
    const importRegex = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]react['"]/g;
    const matches = code.matchAll(importRegex);
    for (const match of matches) {
      const fullStatement = match[0];
      const clause = match[1] || "";
      // If the entire statement is a type-only import: `import type ... from "react"`
      if (/^import\s+type\b/.test(fullStatement.trim())) {
        continue;
      }
      if (new RegExp(`\\b${hook}\\b`).test(clause)) {
        // Skip inline type keyword: `import { type useState }`
        if (!new RegExp(`\\btype\\s+${hook}\\b`).test(clause)) {
          detected.add(hook);
        }
      }
    }

    // 2. React.hook member access (e.g. React.useState, React.useEffect, React.createContext)
    if (new RegExp(`\\bReact\\s*\\.\\s*${hook}\\b`).test(code)) {
      detected.add(hook);
    }
  }

  return Array.from(detected);
}

/**
 * Extracts runtime module import and re-export specifiers from source code,
 * filtering out type-only imports and exports.
 */
export function extractRuntimeImportSpecifiers(content: string): string[] {
  const code = stripCommentsAndPreserveStrings(content);
  const specs = new Set<string>();

  // 1. Bare side-effect imports: import "specifier" or import 'specifier'
  const bareImportRegex = /import\s+['"]([^'"]+)['"]/g;
  const bareMatches = code.matchAll(bareImportRegex);
  for (const match of bareMatches) {
    const spec = match[1];
    if (spec) specs.add(spec);
  }

  // 2. Value import/export with from: import ... from "specifier" or export ... from "specifier"
  // Note: [^"';]*? ensures the clause does not cross quotes or statement semicolons
  const fromRegex = /(?:import|export)\s+(?:type\s+)?([^"';]*?)\s+from\s+['"]([^'"]+)['"]/g;
  const fromMatches = code.matchAll(fromRegex);
  for (const match of fromMatches) {
    const fullStatement = match[0].trim();
    const specifier = match[2];
    if (!specifier) continue;

    // Skip pure type-only imports/exports: `import type ...` or `export type ...`
    if (/^(?:import|export)\s+type\b/.test(fullStatement)) {
      continue;
    }

    specs.add(specifier);
  }

  // 3. Dynamic imports: import("...")
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicMatches = code.matchAll(dynamicRegex);
  for (const match of dynamicMatches) {
    const spec = match[1];
    if (spec) specs.add(spec);
  }

  return Array.from(specs);
}

/**
 * Resolves a module import specifier against an in-memory map of files.
 */
export function resolveImport(
  fromPath: string,
  specifier: string,
  fileMap: Map<string, string>,
): string | null {
  // Ignore static assets that are not executable code modules
  if (/\.(css|json|svg|png|jpg|jpeg|webp|wasm|ico|txt|pdf)$/i.test(specifier)) {
    return null;
  }

  let target: string;
  if (specifier.startsWith("@/")) {
    target = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    target = normalize(join(dirname(fromPath), specifier)).replace(/\\/g, "/");
  } else {
    // External npm or node package
    return null;
  }

  const candidates = [
    target,
    `${target}.tsx`,
    `${target}.ts`,
    `${target}.jsx`,
    `${target}.js`,
    `${target}/index.tsx`,
    `${target}/index.ts`,
    `${target}/index.jsx`,
    `${target}/index.js`,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (fileMap.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Determines whether a file path represents a Next.js App Router entry point.
 */
export function isAppRouterEntry(path: string): boolean {
  const norm = normalizePath(path);
  if (!norm.startsWith("src/app/") && !norm.startsWith("app/")) {
    return false;
  }
  if (/\.(test|spec)\.[^.]+$/.test(norm)) {
    return false;
  }
  return /^(?:src\/)?app\/(?:.*\/)?(page|layout|template|default|loading|error|global-error|not-found|route|robots|sitemap|opengraph-image)\.(tsx|ts|jsx|js)$/.test(
    norm,
  );
}

/**
 * Pure checker evaluating file records for React client-only hook violations
 * reachable from src/app without a 'use client' directive.
 */
export function checkClientBoundaries(
  files: readonly SourceFileRecord[],
): ClientBoundaryViolation[] {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(normalizePath(f.path), f.content);
  }

  // Find App Router entry points
  const entries: string[] = [];
  for (const path of fileMap.keys()) {
    if (isAppRouterEntry(path)) {
      entries.push(path);
    }
  }

  entries.sort();

  const violations: ClientBoundaryViolation[] = [];
  const reportedFiles = new Set<string>();
  const visitedServerFiles = new Set<string>();

  for (const entry of entries) {
    const content = fileMap.get(entry) ?? "";
    if (hasUseClientDirective(content)) {
      // Entry point is explicitly a Client Component.
      continue;
    }

    const queue: { path: string; chain: readonly string[] }[] = [{ path: entry, chain: [entry] }];

    while (queue.length > 0) {
      const nextItem = queue.shift();
      if (!nextItem) break;
      const { path: currentPath, chain } = nextItem;

      if (visitedServerFiles.has(currentPath)) {
        continue;
      }
      visitedServerFiles.add(currentPath);

      const currentContent = fileMap.get(currentPath);
      if (!currentContent) continue;

      // Check if this Server Component module uses client hooks
      const hooks = detectClientHookUsages(currentContent);
      if (hooks.length > 0 && !reportedFiles.has(currentPath)) {
        reportedFiles.add(currentPath);
        violations.push({
          file: currentPath,
          hooks,
          chain,
          message: `Module '${currentPath}' uses React client-only hook(s) [${hooks.join(", ")}] but is reachable from App Router entry '${chain[0]}' without a 'use client' directive.`,
          repair: `Add the 'use client' directive at the top of '${currentPath}' or at a parent boundary in the import chain (${chain.join(" -> ")}).`,
        });
      }

      // Traverse runtime imports
      const specifiers = extractRuntimeImportSpecifiers(currentContent);
      for (const spec of specifiers) {
        const resolved = resolveImport(currentPath, spec, fileMap);
        if (!resolved) continue;

        const resolvedContent = fileMap.get(resolved);
        if (!resolvedContent) continue;

        // If the imported module has 'use client', it forms a Client Component boundary.
        // RSC traversal stops here.
        if (hasUseClientDirective(resolvedContent)) {
          continue;
        }

        // Module does NOT have 'use client', so it is in the Server Component graph.
        queue.push({
          path: resolved,
          chain: [...chain, resolved],
        });
      }
    }
  }

  return violations;
}

/**
 * Scans the filesystem for all source files under `src/` to check against the gate.
 */
export function collectAppRouterSourceFiles(rootDir: string = process.cwd()): SourceFileRecord[] {
  const records: SourceFileRecord[] = [];
  const visitedDirs = new Set<string>();

  function walk(currentDir: string) {
    if (visitedDirs.has(currentDir)) return;
    visitedDirs.add(currentDir);

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== "node_modules" &&
          entry.name !== ".next" &&
          entry.name !== ".git" &&
          entry.name !== "artifacts"
        ) {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(tsx|ts|jsx|js|mjs)$/.test(entry.name)) {
        const relPath = normalize(resolve(fullPath).slice(resolve(rootDir).length + 1)).replace(
          /\\/g,
          "/",
        );
        try {
          const content = readFileSync(fullPath, "utf8");
          records.push({ path: relPath, content });
        } catch {
          // Ignore unreadable files
        }
      }
    }
  }

  const srcDir = join(rootDir, "src");
  if (existsSync(srcDir)) {
    walk(srcDir);
  }

  return records;
}

/**
 * CLI execution entry point.
 */
export function runClientBoundaryGateCli(rootDir: string = process.cwd()): number {
  const files = collectAppRouterSourceFiles(rootDir);
  const violations = checkClientBoundaries(files);

  if (violations.length > 0) {
    console.error(
      `\n🚨 RSC Client Boundary Gate Failed (${violations.length} violation${violations.length === 1 ? "" : "s"} found):`,
    );
    for (const v of violations) {
      console.error(`\n  [client-hook-boundary] ${v.file}`);
      console.error(`    ${v.message}`);
      console.error(`    Import chain: ${v.chain.join(" -> ")}`);
      console.error(`    Repair: ${v.repair}`);
    }
    return 1;
  }

  console.log(
    `✔ RSC client boundary gate passed (${files.length} source files checked, 0 violations).`,
  );
  return 0;
}

// Auto-run if executed directly
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("rsc-client-boundary.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  const exitCode = runClientBoundaryGateCli(process.cwd());
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
