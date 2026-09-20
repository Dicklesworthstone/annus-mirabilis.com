/**
 * The client surface: which files under src/ are client components, and what they import.
 *
 * Extracted for am-84kb. The client import boundary gate used to define its population as three
 * directory literals - src/app, src/visuals, src/components - and 37 of the 126 client-marked files
 * under src/ were outside all three, including the whole reader shell and equation layer. Nothing
 * was escaping, but a regression in those 37 could not have been caught, because they were never in
 * the denominator.
 *
 * Two decisions worth stating, because both were measured rather than assumed:
 *
 * 1. THE POPULATION IS EVERY TYPESCRIPT FILE UNDER src/, with no directory list to fall behind the
 *    tree. The sibling gate noPhysicsInComponents.test.ts uses "every .tsx plus .ts under four
 *    named prefixes", which is far better than three literals but still misses five client-marked
 *    files here (PermalinkRobotsManager.ts, presentation.ts, useGenericWasmSource.ts and two test
 *    files). Adopting it wholesale would have reproduced this bead's defect one level down.
 *
 * 2. "use client" IS A DIRECTIVE, NOT A SUBSTRING. Searching the text for the characters counts any
 *    file that merely mentions them - clientImportBoundary.test.ts and rscClientBoundary.test.ts
 *    both carry the phrase in fixture strings and are not client components. Reading the first
 *    statement through the parser returns 124 where the substring returns 126, and the two it drops
 *    are exactly those files. It adds none, so nothing is lost by being precise.
 */

import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import ts from "typescript";

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git"]);
const TYPESCRIPT_FILE = /\.(tsx|ts|mts|jsx|js|mjs)$/;

/** Every TypeScript-ish file under `dir`, as repository-relative paths. */
export async function walkTypeScriptFiles(root: string, dir: string): Promise<string[]> {
  const found: string[] = [];
  const visit = async (current: string): Promise<void> => {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      // A missing or unreadable directory yields nothing here. The caller asserts a population
      // floor, so an empty result fails loudly instead of passing as "no violations found".
      return;
    }
    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await visit(full);
      } else if (TYPESCRIPT_FILE.test(entry.name)) {
        found.push(relative(root, full));
      }
    }
  };
  await visit(resolve(root, dir));
  return found.sort();
}

function sourceFileFor(repoRelativePath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(
    repoRelativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    repoRelativePath.endsWith(".tsx") || repoRelativePath.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
}

/**
 * True when the file opens with the `"use client"` directive, which is what makes React treat it as
 * a client component. Other directives ("use strict") are skipped; the first ordinary statement
 * ends the prologue.
 */
export function hasUseClientDirective(repoRelativePath: string, content: string): boolean {
  const sourceFile = sourceFileFor(repoRelativePath, content);
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      (ts.isStringLiteral(statement.expression) ||
        ts.isNoSubstitutionTemplateLiteral(statement.expression))
    ) {
      if (statement.expression.text === "use client") return true;
      continue;
    }
    return false;
  }
  return false;
}

/** The gate also treats everything under a visuals directory as client code, as it always has. */
export function isClientSurfaceFile(repoRelativePath: string, content: string): boolean {
  return repoRelativePath.includes("/visuals/") || hasUseClientDirective(repoRelativePath, content);
}

export interface ImportSpecifier {
  readonly specifier: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Every static and dynamic import or re-export specifier, from the parser.
 *
 * Never a line regex: a regex over source text cannot tell an import from the same characters
 * inside a comment, a JSX string or a test fixture, and this gate's whole subject is a population
 * that a textual rule got wrong.
 */
export function extractImportSpecifiers(
  repoRelativePath: string,
  content: string,
): ImportSpecifier[] {
  const sourceFile = sourceFileFor(repoRelativePath, content);
  const specifiers: ImportSpecifier[] = [];
  const record = (node: ts.Node, specifier: string): void => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    specifiers.push({ specifier, line: line + 1, text: node.getText(sourceFile).slice(0, 200) });
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      record(node, node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      record(node, (node.arguments[0] as ts.StringLiteral).text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      record(node, (node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

/**
 * Which of `prefixes` no scanned file lives under.
 *
 * The old gate asserted a non-empty walk per directory because its walk swallowed readdir errors, so
 * a renamed root would have left it inspecting nothing and passing. The population no longer names
 * directories, but that property is worth keeping: these roots are known to hold client code, and a
 * tree where one contributes nothing is a tree the gate has stopped covering. Exported so the
 * property can be driven red without renaming a directory eight panes are working in.
 */
export function unrepresentedRoots(
  files: readonly string[],
  prefixes: readonly string[],
): string[] {
  return prefixes.filter((prefix) => !files.some((file) => file.startsWith(prefix)));
}
