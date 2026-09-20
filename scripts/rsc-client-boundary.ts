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

export const FORBIDDEN_CLIENT_NODE_BUILTINS = [
  "fs",
  "path",
  "child_process",
  "os",
  "crypto",
] as const;

export type ForbiddenClientNodeBuiltin = (typeof FORBIDDEN_CLIENT_NODE_BUILTINS)[number];

export interface SourceFileRecord {
  readonly path: string;
  readonly content: string;
}

export interface ClientBoundaryViolation {
  readonly file: string;
  readonly kind: "client-hook-in-server-component" | "node-builtin-in-client-component";
  readonly hooks: readonly string[];
  readonly builtins?: readonly string[];
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
 * Checks if an import specifier refers to a forbidden Node.js builtin module.
 * Matches `node:...` scheme imports as well as unprefixed standard Node builtins
 * for the forbidden set: fs, path, child_process, os, crypto.
 */
export function isNodeBuiltinSpecifier(specifier: string): boolean {
  const stripped = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const base = stripped.split("/")[0] ?? stripped;
  return (FORBIDDEN_CLIENT_NODE_BUILTINS as readonly string[]).includes(base);
}

/**
 * Detects imports or require calls of Node.js builtin modules in source code.
 */
export function detectNodeBuiltinUsages(content: string): string[] {
  const specifiers = extractRuntimeImportSpecifiers(content);
  const detected = new Set<string>();
  for (const spec of specifiers) {
    if (isNodeBuiltinSpecifier(spec)) {
      detected.add(spec);
    }
  }
  return Array.from(detected).sort();
}

/**
 * Extracts runtime module import and re-export specifiers from source code,
 * filtering out type-only imports and exports. Handles ES imports, dynamic imports,
 * and CommonJS require calls.
 */
export interface ImportSpecifierOptions {
  /**
   * Whether `import type ...` / `export type ...` specifiers count.
   *
   * The client-boundary rules ask what the BUNDLE loads, so a type-only import
   * is correctly invisible to them: it is erased. A question about whether a
   * module exists is a different question, and `tsc` reports TS2307 for a
   * missing type-only import exactly as it does for a runtime one, so the
   * tracked-imports gate (am-zm52) sets this.
   */
  readonly includeTypeOnly?: boolean;
}

export function extractImportSpecifiers(
  content: string,
  options: ImportSpecifierOptions = {},
): string[] {
  const includeTypeOnly = options.includeTypeOnly === true;
  const code = stripCommentsAndPreserveStrings(content);
  const specs = new Set<string>();

  // 1. Bare side-effect imports: import "specifier" or import 'specifier' or import `specifier`
  const bareImportRegex = /import\s+['"`]([^'"`]+)['"`]/g;
  const bareMatches = code.matchAll(bareImportRegex);
  for (const match of bareMatches) {
    const spec = match[1];
    if (spec) specs.add(spec);
  }

  // 2. Value import/export with from: import ... from "specifier" or export ... from "specifier"
  // Note: [^"';`]*? ensures the clause does not cross quotes or statement semicolons
  const fromRegex = /(?:import|export)\s+(?:type\s+)?([^"';`]*?)\s+from\s+['"`]([^'"`]+)['"`]/g;
  const fromMatches = code.matchAll(fromRegex);
  for (const match of fromMatches) {
    const fullStatement = match[0].trim();
    const specifier = match[2];
    if (!specifier) continue;

    // Skip pure type-only imports/exports: `import type ...` or `export type ...`
    if (!includeTypeOnly && /^(?:import|export)\s+type\b/.test(fullStatement)) {
      continue;
    }

    specs.add(specifier);
  }

  // 3. Dynamic imports: import("...")
  const dynamicRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const dynamicMatches = code.matchAll(dynamicRegex);
  for (const match of dynamicMatches) {
    const spec = match[1];
    if (spec) specs.add(spec);
  }

  // 4. CommonJS require: require("...")
  const requireRegex = /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const requireMatches = code.matchAll(requireRegex);
  for (const match of requireMatches) {
    const spec = match[1];
    if (spec) specs.add(spec);
  }

  return Array.from(specs);
}

/**
 * The runtime import specifiers of a module: what the bundle actually loads.
 */
export function extractRuntimeImportSpecifiers(content: string): string[] {
  return extractImportSpecifiers(content);
}

/**
 * Every repo-relative path a specifier could resolve to, in resolution order.
 *
 * Empty for an external package or a static asset. Shared by `resolveImport`
 * and by the tracked-imports gate, which asks the same question against the
 * git index and the disk rather than against an in-memory map. One resolution
 * order, so the two cannot disagree about what a specifier means.
 */
export function importCandidatePaths(fromPath: string, specifier: string): string[] {
  // Ignore static assets that are not executable code modules
  if (/\.(css|json|svg|png|jpg|jpeg|webp|wasm|ico|txt|pdf)$/i.test(specifier)) {
    return [];
  }

  let target: string;
  if (specifier.startsWith("@/")) {
    target = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    target = normalize(join(dirname(fromPath), specifier)).replace(/\\/g, "/");
  } else {
    // External npm or node package
    return [];
  }

  return [
    target,
    `${target}.tsx`,
    `${target}.ts`,
    `${target}.jsx`,
    `${target}.js`,
    `${target}/index.tsx`,
    `${target}/index.ts`,
    `${target}/index.jsx`,
    `${target}/index.js`,
  ].map(normalizePath);
}

/**
 * Resolves a module import specifier against an in-memory map of files.
 */
export function resolveImport(
  fromPath: string,
  specifier: string,
  fileMap: Map<string, string>,
): string | null {
  for (const candidate of importCandidatePaths(fromPath, specifier)) {
    if (fileMap.has(candidate)) return candidate;
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
 * Pure checker evaluating file records for:
 * 1. React client-only hook violations reachable from src/app without a 'use client' directive.
 * 2. Node.js builtin violations reachable from src/app across a 'use client' boundary, or from any 'use client' component.
 */
export function checkClientBoundaries(
  files: readonly SourceFileRecord[],
): ClientBoundaryViolation[] {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(normalizePath(f.path), f.content);
  }

  // 1. Find App Router entry points
  const appEntries: string[] = [];
  for (const path of fileMap.keys()) {
    if (isAppRouterEntry(path)) {
      appEntries.push(path);
    }
  }
  appEntries.sort();

  // 2. Find explicit 'use client' modules anywhere in the file map
  const clientRoots: string[] = [];
  for (const [path, content] of fileMap.entries()) {
    if (hasUseClientDirective(content)) {
      clientRoots.push(path);
    }
  }
  clientRoots.sort();

  const violations: ClientBoundaryViolation[] = [];
  const reportedHookFiles = new Set<string>();
  const reportedBuiltinFiles = new Set<string>();

  const visitedServerFiles = new Set<string>();
  const visitedClientFiles = new Set<string>();

  // Exploration queue
  const queue: { path: string; chain: readonly string[]; inClient: boolean }[] = [];

  function processQueue() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { path: currentPath, chain, inClient } = item;

      if (inClient) {
        if (visitedClientFiles.has(currentPath)) {
          continue;
        }
        visitedClientFiles.add(currentPath);

        const currentContent = fileMap.get(currentPath);
        if (!currentContent) continue;

        // In Client Component context: Node builtins are strictly forbidden.
        const builtins = detectNodeBuiltinUsages(currentContent);
        if (builtins.length > 0 && !reportedBuiltinFiles.has(currentPath)) {
          reportedBuiltinFiles.add(currentPath);
          violations.push({
            file: currentPath,
            kind: "node-builtin-in-client-component",
            hooks: [],
            builtins,
            chain,
            message: `Module '${currentPath}' imports Node builtin(s) [${builtins.join(", ")}] but is evaluated in Client Component context (reachable via ${chain.join(" -> ")}).`,
            repair: `Remove Node builtin imports from '${currentPath}', move server-only logic to a Server Component or route handler, or isolate browser-safe exports into a separate module.`,
          });
        }

        // Traverse all runtime imports in Client Component context
        const specifiers = extractRuntimeImportSpecifiers(currentContent);
        for (const spec of specifiers) {
          const resolved = resolveImport(currentPath, spec, fileMap);
          if (!resolved) continue;

          const resolvedContent = fileMap.get(resolved);
          if (!resolvedContent) continue;

          // Downstream imports remain in Client Component context
          queue.push({
            path: resolved,
            chain: [...chain, resolved],
            inClient: true,
          });
        }
      } else {
        if (visitedServerFiles.has(currentPath)) {
          continue;
        }
        visitedServerFiles.add(currentPath);

        const currentContent = fileMap.get(currentPath);
        if (!currentContent) continue;

        // In Server Component context: React client-only hooks are strictly forbidden.
        const hooks = detectClientHookUsages(currentContent);
        if (hooks.length > 0 && !reportedHookFiles.has(currentPath)) {
          reportedHookFiles.add(currentPath);
          violations.push({
            file: currentPath,
            kind: "client-hook-in-server-component",
            hooks,
            builtins: [],
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

          if (hasUseClientDirective(resolvedContent)) {
            // Crosses into Client Component boundary!
            queue.push({
              path: resolved,
              chain: [...chain, resolved],
              inClient: true,
            });
          } else {
            // Remains in Server Component context
            queue.push({
              path: resolved,
              chain: [...chain, resolved],
              inClient: false,
            });
          }
        }
      }
    }
  }

  // 1. Traverse all App Router entries
  for (const entry of appEntries) {
    const content = fileMap.get(entry) ?? "";
    const isClient = hasUseClientDirective(content);
    queue.push({
      path: entry,
      chain: [entry],
      inClient: isClient,
    });
  }
  processQueue();

  // 2. Traverse any remaining client roots (e.g. isolated test fixtures or unattached client components)
  for (const clientPath of clientRoots) {
    if (!visitedClientFiles.has(clientPath)) {
      queue.push({
        path: clientPath,
        chain: [clientPath],
        inClient: true,
      });
    }
  }
  processQueue();

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

/* ------------------------------------------------------------------------- *
 * Schema layer boundary (am-bwnf)
 *
 * The checks above are incident detectors: they fire when a Client Component
 * already reaches a Node builtin. The schema layer needs a standing rule
 * instead, because `src/content/schemas/` is where the recurring outage was
 * manufactured -- single modules held pure types, constants and predicates
 * beside `node:fs` loaders, so any Client Component that needed a content type
 * dragged the filesystem with it.
 *
 * The convention this enforces:
 *   - `src/content/schemas/**;/*.pure.ts` is the client-safe half of a schema.
 *     It reads nothing, and it depends on nothing that reads anything.
 *   - every other module under `src/content/schemas/` is server-only and may
 *     load files freely.
 *
 * Three assertions follow. The second is the one the reachability checks above
 * cannot make: a `.pure.ts` module is held to its contract even while no Client
 * Component imports it yet, so the trap is disarmed before the next component
 * walks into it.
 * ------------------------------------------------------------------------- */

export const SCHEMA_LAYER_PREFIX = "src/content/schemas/";
export const CLIENT_SAFE_SCHEMA_SUFFIX = ".pure.ts";

export type SchemaBoundaryViolationKind =
  | "node-builtin-in-client-reachable-schema"
  | "node-builtin-in-pure-schema-module"
  | "server-schema-import-in-pure-schema-module";

export interface SchemaBoundaryViolation {
  readonly file: string;
  readonly kind: SchemaBoundaryViolationKind;
  /** The module that actually carries the offending import. */
  readonly offender: string;
  readonly builtins: readonly string[];
  /** Import chain from the reported file to the offender, inclusive. */
  readonly chain: readonly string[];
  readonly message: string;
  readonly repair: string;
}

export function isSchemaLayerModule(path: string): boolean {
  return normalizePath(path).startsWith(SCHEMA_LAYER_PREFIX);
}

export function isClientSafeSchemaModule(path: string): boolean {
  const norm = normalizePath(path);
  return norm.startsWith(SCHEMA_LAYER_PREFIX) && norm.endsWith(CLIENT_SAFE_SCHEMA_SUFFIX);
}

function isTestModule(path: string): boolean {
  return /\.(test|spec)\.[^.]+$/.test(normalizePath(path));
}

/**
 * Breadth-first search for the shortest runtime import chain from `start` to a
 * module that imports a forbidden Node builtin. Returns null when the whole
 * reachable closure is free of them.
 */
export function findNodeBuiltinImportPath(
  start: string,
  fileMap: Map<string, string>,
): { offender: string; builtins: readonly string[]; chain: readonly string[] } | null {
  const visited = new Set<string>([start]);
  const queue: { path: string; chain: readonly string[] }[] = [{ path: start, chain: [start] }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const content = fileMap.get(item.path);
    if (content === undefined) continue;

    const builtins = detectNodeBuiltinUsages(content);
    if (builtins.length > 0) {
      return { offender: item.path, builtins, chain: item.chain };
    }

    for (const spec of extractRuntimeImportSpecifiers(content)) {
      const resolved = resolveImport(item.path, spec, fileMap);
      if (!resolved || visited.has(resolved)) continue;
      visited.add(resolved);
      queue.push({ path: resolved, chain: [...item.chain, resolved] });
    }
  }

  return null;
}

/**
 * Collects every module evaluated in Client Component context, with the import
 * chain that put it there. Traversal matches `checkClientBoundaries`: App
 * Router entries are explored in Server Component context until a 'use client'
 * directive crosses the boundary, and every 'use client' module is a root in
 * its own right.
 */
export function collectClientContextChains(
  fileMap: Map<string, string>,
): Map<string, readonly string[]> {
  const clientChains = new Map<string, readonly string[]>();
  const serverVisited = new Set<string>();
  const serverQueue: { path: string; chain: readonly string[] }[] = [];
  const clientQueue: { path: string; chain: readonly string[] }[] = [];

  for (const path of [...fileMap.keys()].sort()) {
    if (isAppRouterEntry(path)) {
      const content = fileMap.get(path) ?? "";
      if (hasUseClientDirective(content)) clientQueue.push({ path, chain: [path] });
      else serverQueue.push({ path, chain: [path] });
    }
  }

  while (serverQueue.length > 0) {
    const item = serverQueue.shift();
    if (!item) break;
    if (serverVisited.has(item.path)) continue;
    serverVisited.add(item.path);
    const content = fileMap.get(item.path);
    if (content === undefined) continue;

    for (const spec of extractRuntimeImportSpecifiers(content)) {
      const resolved = resolveImport(item.path, spec, fileMap);
      if (!resolved) continue;
      const resolvedContent = fileMap.get(resolved);
      if (resolvedContent === undefined) continue;
      const next = { path: resolved, chain: [...item.chain, resolved] };
      if (hasUseClientDirective(resolvedContent)) clientQueue.push(next);
      else serverQueue.push(next);
    }
  }

  for (const [path, content] of [...fileMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (hasUseClientDirective(content)) {
      clientQueue.push({ path, chain: [path] });
    }
  }

  while (clientQueue.length > 0) {
    const item = clientQueue.shift();
    if (!item) break;
    if (clientChains.has(item.path)) continue;
    clientChains.set(item.path, item.chain);
    const content = fileMap.get(item.path);
    if (content === undefined) continue;

    for (const spec of extractRuntimeImportSpecifiers(content)) {
      const resolved = resolveImport(item.path, spec, fileMap);
      if (!resolved || clientChains.has(resolved)) continue;
      clientQueue.push({ path: resolved, chain: [...item.chain, resolved] });
    }
  }

  return clientChains;
}

/**
 * The standing schema-layer rule. See the comment block above for the contract.
 */
export function checkSchemaLayerBoundaries(
  files: readonly SourceFileRecord[],
): SchemaBoundaryViolation[] {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(normalizePath(f.path), f.content);
  }

  const violations: SchemaBoundaryViolation[] = [];

  // 1. No schema module a Client Component reaches may carry a Node builtin,
  //    itself or through anything it imports. Reported at the point where the
  //    client chain first enters the schema layer, because that is the module
  //    whose pure half is missing.
  const clientChains = collectClientContextChains(fileMap);
  const reportedEntries = new Set<string>();
  for (const [path, chain] of clientChains) {
    if (!isSchemaLayerModule(path) || isTestModule(path)) continue;
    const importer = chain[chain.length - 2];
    if (importer !== undefined && isSchemaLayerModule(importer)) continue; // not the entry
    if (reportedEntries.has(path)) continue;

    const found = findNodeBuiltinImportPath(path, fileMap);
    if (!found) continue;
    reportedEntries.add(path);
    const throughSuffix =
      found.offender === path ? "" : ` through ${found.chain.slice(1).join(" -> ")}`;
    violations.push({
      file: path,
      kind: "node-builtin-in-client-reachable-schema",
      offender: found.offender,
      builtins: found.builtins,
      chain: [...chain, ...found.chain.slice(1)],
      message: `Schema module '${path}' is reachable from Client Component context (via ${chain.join(" -> ")}) and reaches Node builtin(s) [${found.builtins.join(", ")}] in '${found.offender}'${throughSuffix}.`,
      repair: `Split '${path}': put the types, constants and predicates a component needs into a sibling '${path.replace(/\.tsx?$/, "")}${CLIENT_SAFE_SCHEMA_SUFFIX}' that imports nothing filesystem-backed, leave the loaders where they are, re-export the pure half so server callers keep one import, and point the component at the pure half.`,
    });
  }

  // 2. A client-safe schema module is held to its contract whether or not a
  //    Client Component imports it today. This is the standing half of the
  //    rule: it fails when the trap is armed, not when someone walks into it.
  for (const path of [...fileMap.keys()].sort()) {
    if (!isClientSafeSchemaModule(path) || isTestModule(path)) continue;
    const found = findNodeBuiltinImportPath(path, fileMap);
    if (!found) continue;
    const throughSuffix =
      found.offender === path ? "" : ` through ${found.chain.slice(1).join(" -> ")}`;
    violations.push({
      file: path,
      kind: "node-builtin-in-pure-schema-module",
      offender: found.offender,
      builtins: found.builtins,
      chain: found.chain,
      message: `Client-safe schema module '${path}' reaches Node builtin(s) [${found.builtins.join(", ")}] in '${found.offender}'${throughSuffix}. A '${CLIENT_SAFE_SCHEMA_SUFFIX}' module reads nothing and depends on nothing that reads anything.`,
      repair: `Move the filesystem work out of '${found.offender}' and into a server-only sibling, or stop '${path}' from importing it at runtime. A type-only import is erased and is always allowed.`,
    });
  }

  // 3. Layering: the pure half never depends on the loader half. Without this
  //    the separation erodes silently the moment a loader is briefly builtin
  //    free, and check 2 stops noticing.
  for (const path of [...fileMap.keys()].sort()) {
    if (!isClientSafeSchemaModule(path) || isTestModule(path)) continue;
    const content = fileMap.get(path);
    if (content === undefined) continue;
    for (const spec of extractRuntimeImportSpecifiers(content)) {
      const resolved = resolveImport(path, spec, fileMap);
      if (!resolved) continue;
      if (!isSchemaLayerModule(resolved) || isClientSafeSchemaModule(resolved)) continue;
      violations.push({
        file: path,
        kind: "server-schema-import-in-pure-schema-module",
        offender: resolved,
        builtins: [],
        chain: [path, resolved],
        message: `Client-safe schema module '${path}' imports server-only schema module '${resolved}' at runtime. The pure half of a schema never depends on the loader half.`,
        repair: `Import the value from a '${CLIENT_SAFE_SCHEMA_SUFFIX}' sibling of '${resolved}', creating one if it does not exist, or make the import type-only if only a type is needed.`,
      });
    }
  }

  return violations;
}

/**
 * CLI execution entry point.
 */
export function runClientBoundaryGateCli(rootDir: string = process.cwd()): number {
  const files = collectAppRouterSourceFiles(rootDir);
  const violations = checkClientBoundaries(files);
  const schemaViolations = checkSchemaLayerBoundaries(files);
  const total = violations.length + schemaViolations.length;

  if (total > 0) {
    console.error(
      `\n🚨 RSC Client Boundary Gate Failed (${total} violation${total === 1 ? "" : "s"} found):`,
    );
    for (const v of violations) {
      const tag =
        v.kind === "node-builtin-in-client-component"
          ? "[node-builtin-in-client-component]"
          : "[client-hook-in-server-component]";
      console.error(`\n  ${tag} ${v.file}`);
      console.error(`    ${v.message}`);
      console.error(`    Import chain: ${v.chain.join(" -> ")}`);
      console.error(`    Repair: ${v.repair}`);
    }
    for (const v of schemaViolations) {
      console.error(`\n  [${v.kind}] ${v.file}`);
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
