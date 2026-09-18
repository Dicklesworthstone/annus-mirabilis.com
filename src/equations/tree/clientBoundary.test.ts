/**
 * Client Bundle Boundary Test for Expression Tree Evaluators.
 *
 * Requirements from am-eq-expression-tree-8kl:
 * "AC: Client bundle boundary: neither evaluateForSpotCheck nor sampleAdmissiblePoint
 *  is imported by any client bundle entry; both are build-time/pipeline-only."
 * "clientBoundary.test.ts: static scan of src/app/ and src/components/ asserting zero imports
 *  of evaluateForSpotCheck or sampleAdmissiblePoint."
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ImportViolation {
  readonly file: string;
  readonly line: number;
  readonly symbol: string;
  readonly statement: string;
}

export function scanForForbiddenEvaluatorImports(
  filePath: string,
  content: string,
): ImportViolation[] {
  const violations: ImportViolation[] = [];
  const lines = content.split("\n");

  const FORBIDDEN_SYMBOLS = ["evaluateForSpotCheck", "sampleAdmissiblePoint"] as const;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Ignore comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    for (const sym of FORBIDDEN_SYMBOLS) {
      // Check for import of forbidden symbol
      // e.g., `import { evaluateForSpotCheck }` or `evaluateForSpotCheck(`
      const importRegex = new RegExp(`\\bimport\\b[^{]*{[^}]*\\b${sym}\\b[^}]*}\\s*from`);
      const requireRegex = new RegExp(`\\brequire\\s*\\([^)]*\\)[^;]*\\b${sym}\\b`);
      const dynamicImportRegex = new RegExp(`import\\s*\\([^)]*\\).*\\b${sym}\\b`);

      if (importRegex.test(line) || requireRegex.test(line) || dynamicImportRegex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          symbol: sym,
          statement: trimmed,
        });
      }
    }
  }

  return violations;
}

function findSourceFiles(dir: string, extensions: readonly string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findSourceFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return results;
}

describe("Expression Tree Client Boundary (clientBoundary.test.ts)", () => {
  const rootDir = join(process.cwd(), "src");
  const scannedDirs = [join(rootDir, "app"), join(rootDir, "components")];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

  it("ensures neither evaluateForSpotCheck nor sampleAdmissiblePoint is imported in client routes or components", () => {
    const allViolations: ImportViolation[] = [];
    let scannedFilesCount = 0;

    for (const dir of scannedDirs) {
      const files = findSourceFiles(dir, extensions);
      for (const file of files) {
        // Exclude test files if any exist within these dirs
        if (file.includes(".test.") || file.includes(".spec.")) {
          continue;
        }
        scannedFilesCount++;
        const content = readFileSync(file, "utf8");
        const violations = scanForForbiddenEvaluatorImports(file, content);
        allViolations.push(...violations);
      }
    }

    expect(scannedFilesCount).toBeGreaterThan(0);
    expect(allViolations).toHaveLength(0);
  });

  it("planted negative: correctly flags forbidden evaluator imports when present", () => {
    const fakeClientCode = `
      import React from "react";
      import { evaluateForSpotCheck } from "../equations/tree/evaluateForSpotCheck";
      import { sampleAdmissiblePoint } from "../equations/tree/sampleAdmissiblePoint";

      export function BadComponent() {
        return <div>Leaked Evaluator</div>;
      }
    `;

    const violations = scanForForbiddenEvaluatorImports(
      "src/components/BadComponent.tsx",
      fakeClientCode,
    );
    expect(violations.length).toBe(2);
    expect(violations.some((v) => v.symbol === "evaluateForSpotCheck")).toBe(true);
    expect(violations.some((v) => v.symbol === "sampleAdmissiblePoint")).toBe(true);
  });
});
