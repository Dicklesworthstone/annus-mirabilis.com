/**
 * am-read-result-weave-jex acceptance criterion: "The weave computes no sample statistic: an
 * import-boundary test shows that src/experiments/weave/ imports no ensemble-statistics function
 * and no src/testing/ module." Real AST parsing (import specifiers), not string grep, matching
 * the pattern of src/testing/noPhysicsInComponents.test.ts.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const WEAVE_DIR = import.meta.dirname;

// Functions this bead's own text and neighboring beads' own weave declarations cite as the
// ensemble-statistics layer the weave must never recompute: BM-05's kolmogorovShapeTerm/dkwBound
// (src/physics/reference/diffusion/walkLaws.ts), and any generic "compute an ensemble/sample
// statistic from raw data" naming convention.
const FORBIDDEN_NAME_PATTERN =
  /ensemble|sampleStatistic|kolmogorovShapeTerm|computeMoments|recordTracers|recordWalks/i;

function weaveSourceFiles(): string[] {
  return readdirSync(WEAVE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(WEAVE_DIR, f));
}

function importSpecifiers(filePath: string): string[] {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

describe("import boundary: src/experiments/weave/ never imports src/testing/ or an ensemble-statistics function", () => {
  const files = weaveSourceFiles();
  test("there is at least one non-test source file to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    test(`${file.split("/").pop()} imports nothing from src/testing/`, () => {
      const specifiers = importSpecifiers(file);
      for (const specifier of specifiers) {
        expect(specifier.includes("/testing/") || specifier.includes("../testing")).toBe(false);
      }
    });

    test(`${file.split("/").pop()} imports no function whose name matches an ensemble-statistics pattern`, () => {
      const text = readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const importedNames: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isImportSpecifier(node)) {
          importedNames.push((node.propertyName ?? node.name).text);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      const violations = importedNames.filter((name) => FORBIDDEN_NAME_PATTERN.test(name));
      expect(violations).toEqual([]);
    });
  }

  test("the weave module as a whole declares no dependency on src/testing/ (source scan, not just per-file)", () => {
    const allSpecifiers = files.flatMap((f) => importSpecifiers(f));
    const testingImports = allSpecifiers.filter((s) => s.includes("testing"));
    expect(testingImports).toEqual([]);
  });
});
