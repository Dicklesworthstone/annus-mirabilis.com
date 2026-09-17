/**
 * am-design-semantic-color-8vbq: spectralMapping.ts's module graph contains
 * no theme token module, and no module derives a spectral color from
 * tokensFor. Real TypeScript-AST import extraction (never a string grep),
 * matching src/testing/noPhysicsInComponents.test.ts's pattern.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return resolve(dirname(fromFile), specifier);
}

describe("spectralMapping.ts: no theme token module in its import graph", () => {
  test("direct imports never reference a theme tokens module", () => {
    const filePath = join(REPO_ROOT, "src/design/spectralMapping.ts");
    const imports = extractImports(filePath);
    for (const specifier of imports) {
      const resolved = resolveSpecifier(filePath, specifier);
      if (resolved) {
        expect(resolved.toLowerCase()).not.toContain("theme");
        expect(resolved.toLowerCase()).not.toContain("semanticcolor");
      }
    }
  });

  test("spectralMapping.ts itself contains no reference to tokensFor or ROLE_TOKENS", () => {
    const filePath = join(REPO_ROOT, "src/design/spectralMapping.ts");
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("tokensFor");
    expect(content).not.toContain("ROLE_TOKENS");
    expect(content).not.toContain("ThemeId");
  });
});
