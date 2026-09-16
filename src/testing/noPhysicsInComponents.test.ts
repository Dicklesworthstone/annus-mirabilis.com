import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The import boundary AGENTS.md's "Kernels own the law" and this bead's
 * requirement 9 enforce: no `.tsx` module anywhere, and no module under
 * `src/visuals/`, `src/reader/`, `src/equations/`, or `src/app/`, may
 * import `src/physics/reference/**`, `src/workers/wasm/**`, or generated
 * WASM glue under `public/wasm/**`. Components read views and dispatch
 * typed commands only; they never independently recompute physics.
 */
const FORBIDDEN_PREFIXES = ["src/physics/reference/", "src/workers/wasm/", "public/wasm/"];
const WATCHED_DIRECTORY_PREFIXES = ["src/visuals/", "src/reader/", "src/equations/", "src/app/"];

export interface Violation {
  readonly file: string;
  readonly importPath: string;
  readonly resolved: string;
}

export function isWatchedPath(repoRelativePath: string): boolean {
  return (
    repoRelativePath.endsWith(".tsx") ||
    WATCHED_DIRECTORY_PREFIXES.some((prefix) => repoRelativePath.startsWith(prefix))
  );
}

/** Extracts every static and dynamic import/export module specifier via the real TypeScript parser, never a string-literal grep (JSX prose mentioning a path is not an import). */
function extractImportSpecifiers(repoRelativePath: string, content: string): string[] {
  const scriptKind = repoRelativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    repoRelativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) specifiers.push(first.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function resolveSpecifier(repoRelativeFromFile: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return undefined;
  const fromDir = path.posix.dirname(repoRelativeFromFile);
  return path.posix.normalize(path.posix.join(fromDir, specifier));
}

export function findPhysicsImportViolations(
  files: readonly { path: string; content: string }[],
): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    for (const importPath of extractImportSpecifiers(file.path, file.content)) {
      const resolved = resolveSpecifier(file.path, importPath);
      if (resolved && FORBIDDEN_PREFIXES.some((prefix) => resolved.startsWith(prefix))) {
        violations.push({ file: file.path, importPath, resolved });
      }
    }
  }
  return violations;
}

function walkRepoTsFiles(rootDir: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const skip = new Set([
    "node_modules",
    ".next",
    ".git",
    ".beads",
    "artifacts",
    ".wrangler",
    ".ntm",
  ]);
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const repoRelative = path.relative(rootDir, full).split(path.sep).join("/");
      // Planted-violation fixtures are deliberately illegal; they are
      // proof material for the checker, never product code it audits.
      if (repoRelative.startsWith("src/testing/fixtures/noPhysicsInComponents/")) continue;
      if (!isWatchedPath(repoRelative)) continue;
      results.push({ path: repoRelative, content: fs.readFileSync(full, "utf8") });
    }
  }
  walk(rootDir);
  return results;
}

describe("no physics in components (import boundary)", () => {
  test("the real source tree contains no forbidden physics import", () => {
    const files = walkRepoTsFiles(REPO_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const violations = findPhysicsImportViolations(files);
    expect(violations).toEqual([]);
  });

  test("the checker rejects the planted violation fixture", () => {
    const repoRelativePath =
      "src/testing/fixtures/noPhysicsInComponents/PlantedViolation.fixture.tsx";
    const content = fs.readFileSync(path.join(REPO_ROOT, repoRelativePath), "utf8");
    // The fixture lives outside the watched directories (it is proof
    // material, not product code), so this test calls the violation
    // detector directly rather than going through `isWatchedPath`, on the
    // real repo-relative path its own `../../../` import was written for.
    const violations = findPhysicsImportViolations([{ path: repoRelativePath, content }]);
    expect(violations).toEqual([
      {
        file: repoRelativePath,
        importPath: "../../../physics/reference/diffusion.ts",
        resolved: "src/physics/reference/diffusion.ts",
      },
    ]);
  });

  test("a JSX string that merely mentions a physics path is not an import", () => {
    const content = `export function Note() { return <code>src/physics/reference/diffusion.ts</code>; }`;
    expect(findPhysicsImportViolations([{ path: "src/reader/Note.tsx", content }])).toEqual([]);
  });

  test("a bare package import and an alias import outside the forbidden prefixes are both ignored", () => {
    const content = [
      `import { useMemo } from "react";`,
      `import { useExperimentView } from "@/experiments/store/useExperimentSnapshot.ts";`,
    ].join("\n");
    expect(findPhysicsImportViolations([{ path: "src/reader/Fine.tsx", content }])).toEqual([]);
  });

  test("files outside the watched set are never scanned", () => {
    expect(isWatchedPath("src/experiments/store/instanceStore.ts")).toBe(false);
    expect(isWatchedPath("src/components/lab/BrownianLab.tsx")).toBe(true);
    expect(isWatchedPath("src/reader/PaperReader.tsx")).toBe(true);
    expect(isWatchedPath("src/app/layout.tsx")).toBe(true);
  });
});
