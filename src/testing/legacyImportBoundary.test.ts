/**
 * Isolation Boundary Test for Legacy Equations (am-scaf-extract-ui-components-c31).
 *
 * Invariant:
 * The legacy colorized equation (retained for migration and donor seam parity)
 * uses brittle human-label lookups and substring token matching. It must NEVER
 * be imported by any module in `src/app` or `src/reader`.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
    // Directory may not exist yet in early scaffold stages
  }
  return results;
}

export function detectLegacyImports(
  filePath: string,
  content: string,
): Array<{ file: string; line: number; importStatement: string }> {
  const violations: Array<{ file: string; line: number; importStatement: string }> = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Check for static imports or dynamic imports matching legacy equation seam
    if (
      /(?:from\s+['"][^'"]*equations\/legacy|import\s*\(\s*['"][^'"]*equations\/legacy)/.test(line)
    ) {
      violations.push({
        file: filePath,
        line: i + 1,
        importStatement: line.trim(),
      });
    }
  }

  return violations;
}

describe("legacyImportBoundary", () => {
  const rootDir = join(process.cwd(), "src");
  const scannedDirs = [join(rootDir, "app"), join(rootDir, "reader")];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

  it("ensures zero modules under src/app or src/reader import from src/equations/legacy/", () => {
    const allViolations: Array<{ file: string; line: number; importStatement: string }> = [];

    for (const dir of scannedDirs) {
      const files = findSourceFiles(dir, extensions);
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        const fileViolations = detectLegacyImports(file, content);
        allViolations.push(...fileViolations);
      }
    }

    if (allViolations.length > 0) {
      const details = allViolations
        .map((v) => `  ${v.file}:${v.line} -> ${v.importStatement}`)
        .join("\n");
      throw new Error(`Forbidden legacy equation imports found in production routes:\n${details}`);
    }

    expect(allViolations).toHaveLength(0);
  });

  it("planted negative test: detector flags forbidden legacy imports", () => {
    const mockCodeWithStaticImport = `
      import React from "react";
      import { ColorizedEquation } from "../equations/legacy/ColorizedEquation";

      export function BadComponent() {
        return <div />;
      }
    `;

    const violations1 = detectLegacyImports("src/app/bad-route/page.tsx", mockCodeWithStaticImport);
    expect(violations1.length).toBeGreaterThanOrEqual(1);
    expect(violations1[0]?.importStatement).toContain("equations/legacy/ColorizedEquation");

    const mockCodeWithDynamicImport = `
      const Comp = React.lazy(() => import("../../equations/legacy/ColorizedEquation"));
    `;
    const violations2 = detectLegacyImports(
      "src/reader/ReaderShell.tsx",
      mockCodeWithDynamicImport,
    );
    expect(violations2.length).toBeGreaterThanOrEqual(1);
  });
});
