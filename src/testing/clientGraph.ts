/**
 * WHAT THE CLIENT GRAPH IMPORTS, WALKED WITHOUT A BUILD (am-t84m).
 *
 * am-t84m: four production deployments failed with `UnhandledSchemeError: Reading from "node:crypto"
 * is not handled by plugins`, while `bun run build` exited 0 locally. Its third acceptance item names
 * the real defect: "A LANE MUST RUN THE BUILD ... Whatever gate you add must fail when a node: builtin
 * re-enters the client graph, and must do so without a full deploy." A type error and a bundling error
 * are different failures, and nothing in this repository looked for the second.
 *
 * This walks the graph statically instead. Every module carrying the "use client" directive is an entry
 * point -- Next puts a client component and everything it imports into the browser bundle -- and from
 * those it follows relative imports and reports any `node:` specifier it reaches, with the chain that
 * led there. The chain is the point: the fourth acceptance item asks for the import chain rather than
 * the builtin, because four builtins in one log may or may not share an importer.
 *
 * TYPE-ONLY IMPORTS ARE ERASED, AND EXCLUDING THEM IS THE WHOLE CORRECTNESS OF THIS GATE.
 * `import type { X } from "./y"` puts nothing in the bundle, so a module reached only through one is
 * not in the client graph. Counting them reported 53 offenders in a graph whose build succeeds, every
 * one arriving through a types module. Excluding them reports 0 over 154 entry modules and 837
 * reachable ones, which is what a working build means.
 *
 * That cut has to be exact in BOTH directions, so the test beside this asserts both: a type-only import
 * of a node builtin is not an offender, and a value import of one is. Cutting too much is the dangerous
 * direction -- it would report a clean graph for ever.
 *
 * WHAT THIS DOES NOT DO. It is not a bundler. It does not resolve package specifiers, follow
 * `require`, or know what Next's own transforms inline, so a builtin reaching the browser through a
 * dependency is outside it. It answers one question -- does a module OF OURS that the client graph
 * reaches import a node builtin -- and that is the question the four failed deployments asked.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export type ClientGraphOffender = Readonly<{
  /** The `node:` specifier that was imported. */
  specifier: string;
  /** Repo-relative path of the module that imports it. */
  importer: string;
  /** From the importer back to the "use client" entry, in that order. */
  chain: readonly string[];
}>;

export type ClientGraphReport = Readonly<{
  entryModules: number;
  reachableModules: number;
  offenders: readonly ClientGraphOffender[];
}>;

/**
 * A VALUE import's specifier. `import type` and `export type` are skipped, and so is a bare
 * `import "./x.css"` side-effect import, which carries no binding but does reach the bundle -- it is
 * matched separately below so a stylesheet is still followed.
 */
const VALUE_IMPORT = /(?:^|\n)\s*import\s+(?!type\s)[^;]*?from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
/** `export { x } from "./y"` re-exports a value; `export type { x }` does not. */
const VALUE_REEXPORT = /(?:^|\n)\s*export\s+(?!type\s)[^;]*?from\s*["']([^"']+)["']/g;

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", "out", "generated"]);

function isTestPath(path: string): boolean {
  return /\.(test|spec)\.[cm]?tsx?$/.test(path) || path.includes(`${sep}testing${sep}`);
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      yield* sourceFiles(full);
      continue;
    }
    if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) yield full;
  }
}

/** Every specifier this module brings into the bundle, type-only imports excluded. */
export function valueImportsOf(text: string): readonly string[] {
  return Object.freeze([
    ...[...text.matchAll(VALUE_IMPORT)].map((m) => m[1] ?? ""),
    ...[...text.matchAll(VALUE_REEXPORT)].map((m) => m[1] ?? ""),
    ...[...text.matchAll(SIDE_EFFECT_IMPORT)].map((m) => m[1] ?? ""),
    ...[...text.matchAll(DYNAMIC_IMPORT)].map((m) => m[1] ?? ""),
  ]);
}

/** A relative specifier resolved to a file on disk, or null when it is not one of ours. */
function resolveRelative(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates)
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

/**
 * THE "use client" DIRECTIVE, WITH A LICENCE HEADER IN FRONT OF IT.
 *
 * This used to be `/^\s*["']use client["']/m` tested against `readFileSync(file).slice(0, 400)`,
 * on the reasoning that "the directive must be at the top of the file to apply, so only the head is
 * read". The reasoning is right and the window was too small. Measured 2026-10-09: SEVEN client
 * entries carry the donor attribution block AGENTS.md requires on every extracted file -- "preserve
 * the license notices (including the rider language) on every extracted file" -- and that block puts
 * the directive at bytes 390, 521, 595, 601, 664, 708 and 729. Six fall past the cut and the
 * seventh is sliced mid-string, so none was an entry: PinnedPdfFacsimile.tsx,
 * usePinnedPdfFacsimile.ts, LatexRenderer.tsx, ColorizedEquation.tsx, CommandPalette.tsx,
 * useGenericWasmSource.ts and StudioKernelChips.tsx. The gate read 166 entries over 904 modules
 * where the truth is 173 over 916.
 *
 * This is the direction this file's own docblock calls the dangerous one -- "Cutting too much ...
 * would report a clean graph for ever" -- and the cut was made by a rule the repository imposes on
 * itself, which is why no amount of care about the regex would have found it. The missed modules are
 * not a random seven: a PDF viewer, a WASM source hook and a Three.js scene are exactly where a
 * node builtin would be reached for.
 *
 * So the whole file is read and the directive is required to be the first STATEMENT, after any run
 * of leading comments. Widening the window to 2000 bytes would have fixed these seven and left the
 * same defect for a longer header.
 */
export function isClientEntry(text: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/.test(text);
}

/** Walks every "use client" module's value imports and reports each `node:` specifier reached. */
export function walkClientGraph(root: string, srcDir = "src"): ClientGraphReport {
  const src = join(root, srcDir);
  if (!existsSync(src)) return { entryModules: 0, reachableModules: 0, offenders: [] };

  const entries: string[] = [];
  for (const file of sourceFiles(src)) {
    if (isTestPath(file)) continue;
    if (isClientEntry(readFileSync(file, "utf8"))) entries.push(file);
  }

  const seen = new Set<string>();
  const offenders: ClientGraphOffender[] = [];
  const stack: { file: string; chain: readonly string[] }[] = entries.map((file) => ({
    file,
    chain: [file],
  }));
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined) break;
    const { file, chain } = next;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const specifier of valueImportsOf(text)) {
      if (specifier.startsWith("node:")) {
        offenders.push(
          Object.freeze({
            specifier,
            importer: relative(root, file),
            chain: Object.freeze(chain.map((c) => relative(root, c))),
          }),
        );
        continue;
      }
      const resolved = resolveRelative(file, specifier);
      if (resolved !== null && !seen.has(resolved))
        stack.push({ file: resolved, chain: [resolved, ...chain] });
    }
  }
  return Object.freeze({
    entryModules: entries.length,
    reachableModules: seen.size,
    offenders: Object.freeze(offenders),
  });
}

/** One line carrying the counts beside the verdict, as a citation must. */
export function summarizeClientGraph(report: ClientGraphReport): string {
  return (
    `${report.entryModules} "use client" entry module(s); ${report.reachableModules} module(s) reachable ` +
    `through value imports; ${report.offenders.length} node: builtin import(s) in the client graph`
  );
}
