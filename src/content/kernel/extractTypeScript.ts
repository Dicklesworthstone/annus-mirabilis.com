import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { hashKernelSource } from "./sourceDigest.ts";
import type { ExtractedKernelSource } from "./types.ts";

export class KernelExtractionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "KernelExtractionError";
    this.code = code;
  }
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function collectIdentifiers(sf: ts.SourceFile, start: number, end: number): string[] {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (node.end < start || node.getStart(sf) > end) return;
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

function isExported(node: ts.Node): boolean {
  const flags = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (flags & ts.ModifierFlags.Export) !== 0;
}

function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function localVariableName(decl: ts.VariableDeclaration): string | undefined {
  return ts.isIdentifier(decl.name) ? decl.name.text : undefined;
}

function resolveSpecifier(root: string, fromFile: string, specifier: string): string {
  const abs = resolve(root, dirname(fromFile), specifier);
  const withTs = abs.endsWith(".ts") || abs.endsWith(".mjs") ? abs : `${abs}.ts`;
  const chosen = existsSync(abs) ? abs : withTs;
  return relative(root, chosen).split("\\").join("/");
}

function isFunctionInit(init: ts.Expression | undefined): boolean {
  return !!init && (ts.isFunctionExpression(init) || ts.isArrowFunction(init));
}

type LocalHit = Readonly<{
  kind: "local";
  nodes: readonly ts.Node[];
  sourceFile: ts.SourceFile;
  filePath: string;
}>;
type Redirect = Readonly<{ kind: "redirect"; modulePath: string; exportName: string }>;
type StarRedirects = Readonly<{ kind: "stars"; specifiers: readonly string[] }>;
type Hit = LocalHit | Redirect | StarRedirects;

function findInFile(sf: ts.SourceFile, exportName: string, filePath: string): Hit | null {
  const overloads: ts.FunctionDeclaration[] = [];
  const starRedirects: string[] = [];

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === exportName && isExported(stmt)) {
      overloads.push(stmt);
    }
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (localVariableName(decl) === exportName && isFunctionInit(decl.initializer)) {
          return { kind: "local", nodes: [stmt], sourceFile: sf, filePath };
        }
      }
    }
    if (!ts.isExportDeclaration(stmt)) continue;
    const from =
      stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined;
    if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text !== exportName) continue;
        const local = el.propertyName?.text ?? el.name.text;
        if (from) return { kind: "redirect", modulePath: from, exportName: local };
        const localHit = findLocalDeclaration(sf, local, filePath);
        if (localHit) return localHit;
      }
    } else if (stmt.exportClause === undefined && from) {
      starRedirects.push(from);
    }
  }
  if (overloads.length > 0) return { kind: "local", nodes: overloads, sourceFile: sf, filePath };
  if (starRedirects.length > 0) return { kind: "stars", specifiers: starRedirects };
  return null;
}

function findLocalDeclaration(sf: ts.SourceFile, name: string, filePath: string): LocalHit | null {
  const overloads: ts.FunctionDeclaration[] = [];
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) overloads.push(stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (localVariableName(decl) === name && isFunctionInit(decl.initializer)) {
          return { kind: "local", nodes: [stmt], sourceFile: sf, filePath };
        }
      }
    }
  }
  if (overloads.length > 0) return { kind: "local", nodes: overloads, sourceFile: sf, filePath };
  return null;
}

/**
 * Locate an exported function by symbol using the TypeScript compiler API.
 * Follows `export { name }`, `export { name } from`, and `export * from`.
 * Emits exact source including JSDoc. Never slices with a regex.
 */
export function extractTypeScriptExport(options: {
  root: string;
  modulePath: string;
  exportName: string;
  revision: string;
  seen?: Set<string>;
}): ExtractedKernelSource {
  const seen = options.seen ?? new Set<string>();
  const abs = resolve(options.root, options.modulePath);
  const rel = relative(options.root, abs).split("\\").join("/");
  if (seen.has(`${rel}#${options.exportName}`)) {
    throw new KernelExtractionError(
      "kernel-reexport-cycle",
      `Re-export cycle while locating ${options.exportName} at ${rel}.`,
    );
  }
  seen.add(`${rel}#${options.exportName}`);
  const text = readFileSync(abs, "utf8");
  const sf = parse(rel, text);
  const hit = findInFile(sf, options.exportName, rel);
  if (!hit) {
    throw new KernelExtractionError(
      "kernel-export-missing",
      `No exported TypeScript function "${options.exportName}" in ${rel}.`,
    );
  }
  if (hit.kind === "redirect" || hit.kind === "stars") {
    const specs = hit.kind === "redirect" ? [hit.modulePath] : hit.specifiers;
    const nextName = hit.kind === "redirect" ? hit.exportName : options.exportName;
    let lastMissing: KernelExtractionError | undefined;
    for (const spec of specs) {
      const nextPath = resolveSpecifier(options.root, rel, spec);
      try {
        return extractTypeScriptExport({
          root: options.root,
          modulePath: nextPath,
          exportName: nextName,
          revision: options.revision,
          seen,
        });
      } catch (err) {
        if (err instanceof KernelExtractionError && err.code === "kernel-export-missing") {
          lastMissing = err;
          continue;
        }
        throw err;
      }
    }
    throw (
      lastMissing ??
      new KernelExtractionError(
        "kernel-export-missing",
        `No exported TypeScript function "${options.exportName}" in ${rel}.`,
      )
    );
  }
  const starts = hit.nodes.map((n) => n.getStart(hit.sourceFile, true));
  const ends = hit.nodes.map((n) => n.end);
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  const source = hit.sourceFile.text.slice(start, end);
  return {
    language: "ts",
    exportName: options.exportName,
    filePath: hit.filePath,
    lineStart: lineOf(hit.sourceFile, start),
    lineEnd: lineOf(hit.sourceFile, Math.max(start, end - 1)),
    source,
    sourceHash: hashKernelSource(source),
    revision: options.revision,
    identifiers: collectIdentifiers(hit.sourceFile, start, end),
  };
}

/**
 * Extract from in-memory source. Does not follow re-exports: the caller must
 * point at the defining module. Overload signatures without bodies are omitted
 * so the result is the implementation.
 *
 * `includeOverloadSignatures` KEEPS THEM, which is what extractTypeScriptExport always does, and it
 * exists because comparing one rule against the other is not a comparison (am-f3e4, 2026-10-06).
 * verify.ts writes a pin with extractTypeScriptExport and then verified it against git HEAD with this
 * function's default, so for any export carrying overload signatures the two spans differed and the
 * pin could never match: classifySimultaneity in events.ts is lines 337-428 and 3003 characters to the
 * path extractor and 352-428 and 2566 to this one, and redescribe beside it is 608-668 against
 * 613-668. The audit then refused with "Pin was written against uncommitted source" against a file git
 * reports clean, which is a message naming the wrong cause and cost someone ten minutes hunting an
 * edit that did not exist.
 *
 * The default is unchanged on purpose. scripts/snapshotFunctionHash.mjs computes hashes that are
 * already stored in generated worked examples, and extract-kernel-source.ts's extractFunctionSource
 * reports the implementation to its callers; flipping the default would move both. Only the comparison
 * opts in.
 */
export function extractTypeScriptFromText(options: {
  fileName: string;
  sourceText: string;
  exportName: string;
  revision?: string;
  includeOverloadSignatures?: boolean;
}): ExtractedKernelSource {
  const sf = parse(options.fileName, options.sourceText);
  const hit = findInFile(sf, options.exportName, options.fileName);
  if (!hit) {
    throw new KernelExtractionError(
      "kernel-export-missing",
      `No exported TypeScript function "${options.exportName}" in ${options.fileName}.`,
    );
  }
  if (hit.kind === "redirect" || hit.kind === "stars") {
    throw new KernelExtractionError(
      "kernel-reexport",
      `"${options.exportName}" is re-exported from ${options.fileName}; point kernel extraction at its defining module.`,
    );
  }
  const impl = hit.nodes.filter((n) => !ts.isFunctionDeclaration(n) || n.body);
  const nodes = options.includeOverloadSignatures ? hit.nodes : impl.length > 0 ? impl : hit.nodes;
  const starts = nodes.map((n) => n.getStart(hit.sourceFile, true));
  const ends = nodes.map((n) => n.end);
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  const source = hit.sourceFile.text.slice(start, end);
  return {
    language: "ts",
    exportName: options.exportName,
    filePath: options.fileName,
    lineStart: lineOf(hit.sourceFile, start),
    lineEnd: lineOf(hit.sourceFile, Math.max(start, end - 1)),
    source,
    sourceHash: hashKernelSource(source),
    revision: options.revision ?? "",
    identifiers: collectIdentifiers(hit.sourceFile, start, end),
  };
}
