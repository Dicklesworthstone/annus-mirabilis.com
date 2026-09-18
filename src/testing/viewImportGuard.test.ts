import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_IMPORT_PATTERNS = [
  { prefix: "src/physics/reference/", reason: "reference evaluator" },
  { prefix: "src/workers/wasm/", reason: "WASM loader" },
  { prefix: "public/wasm/", reason: "compiled WASM binary" },
  { prefix: "src/content/datasets/statistics", reason: "statistics function" },
  { prefix: "src/physics/reference/diffusion/statistics", reason: "statistics function" },
  { prefix: "src/testing/stats", reason: "statistics function" },
];

export interface ViewImportViolation {
  readonly file: string;
  readonly importPath: string;
  readonly resolved: string;
  readonly reason: string;
}

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

function resolveSpecifier(fromRepoRelative: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return undefined;
  const fromDir = path.posix.dirname(fromRepoRelative);
  return path.posix.normalize(path.posix.join(fromDir, specifier));
}

export function findViewImportViolations(
  files: readonly { path: string; content: string }[],
): ViewImportViolation[] {
  const violations: ViewImportViolation[] = [];
  for (const file of files) {
    for (const specifier of extractImportSpecifiers(file.path, file.content)) {
      const resolved = resolveSpecifier(file.path, specifier);
      if (!resolved) continue;
      for (const forbidden of FORBIDDEN_IMPORT_PATTERNS) {
        if (resolved === forbidden.prefix || resolved.startsWith(forbidden.prefix)) {
          violations.push({
            file: file.path,
            importPath: specifier,
            resolved,
            reason: forbidden.reason,
          });
        }
      }
    }
  }
  return violations;
}

function walkViewFiles(rootDir: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const targetDirs = [path.join(rootDir, "src/visuals"), path.join(rootDir, "src/components/lab")];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const repoRelative = path.relative(rootDir, full).split(path.sep).join("/");
      results.push({ path: repoRelative, content: fs.readFileSync(full, "utf8") });
    }
  }

  for (const td of targetDirs) walk(td);
  return results;
}

describe("viewImportGuard: views cannot import reference evaluators, WASM loaders, or statistics functions", () => {
  test("the production view modules contain zero forbidden imports", () => {
    const files = walkViewFiles(REPO_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const violations = findViewImportViolations(files);
    expect(violations).toEqual([]);
  });

  test("rejects planted reference evaluator import in fixture directory", () => {
    const fixturePath = "src/testing/fixtures/viewImportGuard/PlantedRefEvaluator.fixture.tsx";
    const full = path.join(REPO_ROOT, fixturePath);
    const content = fs.readFileSync(full, "utf8");
    const violations = findViewImportViolations([{ path: fixturePath, content }]);
    expect(violations.length).toBe(1);
    expect(violations[0]?.reason).toBe("reference evaluator");
    expect(violations[0]?.resolved).toContain("physics/reference");
  });

  test("rejects planted WASM loader import in fixture directory", () => {
    const fixturePath = "src/testing/fixtures/viewImportGuard/PlantedWasmLoader.fixture.tsx";
    const full = path.join(REPO_ROOT, fixturePath);
    const content = fs.readFileSync(full, "utf8");
    const violations = findViewImportViolations([{ path: fixturePath, content }]);
    expect(violations.length).toBe(1);
    expect(violations[0]?.reason).toBe("WASM loader");
    expect(violations[0]?.resolved).toContain("workers/wasm");
  });

  test("rejects planted statistics function import in fixture directory", () => {
    const fixturePath = "src/testing/fixtures/viewImportGuard/PlantedStatistics.fixture.tsx";
    const full = path.join(REPO_ROOT, fixturePath);
    const content = fs.readFileSync(full, "utf8");
    const violations = findViewImportViolations([{ path: fixturePath, content }]);
    expect(violations.length).toBe(1);
    expect(violations[0]?.reason).toBe("statistics function");
    expect(violations[0]?.resolved).toContain("content/datasets/statistics");
  });
});
