import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const FORBIDDEN_PATTERNS = [
  /Math\.abs\s*\([^)]+-[^)]+\)\s*<=\s*([a-zA-Z0-9_]+|0\.\d+)/,
  /Math\.abs\s*\([^)]+-[^)]+\)\s*<\s*([a-zA-Z0-9_]+|0\.\d+)/,
  /withinToleranceFormula/,
];

function scanFileForComparisons(filePath: string): { line: number; match: string }[] {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const matches: { line: number; match: string }[] = [];

  for (const [i, line] of lines.entries()) {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        matches.push({ line: i + 1, match: m[0] });
      }
    }
  }

  return matches;
}

describe("No Display Comparison Scan (am-ver-precision-display-5e5)", () => {
  it("detects a planted comparison formula in a fixture string", () => {
    const plantedFixture = `
      function customCheck(a, b, tol) {
        return Math.abs(a - b) <= tol;
      }
    `;
    const lines = plantedFixture.split("\n");
    let detected = false;
    for (const line of lines) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (line.match(pattern)) detected = true;
      }
    }
    expect(detected).toBe(true);
  });

  it("verifies that no display or formatting module contains ad-hoc comparison formulas", () => {
    const unitsDir = path.join(process.cwd(), "src", "units");
    const displayFiles = [
      path.join(unitsDir, "format.ts"),
      path.join(unitsDir, "uncertainty.ts"),
      path.join(unitsDir, "sensitivity.ts"),
      path.join(unitsDir, "verdictText.ts"),
      path.join(unitsDir, "ValueWithUncertainty.tsx"),
    ];

    for (const file of displayFiles) {
      const violations = scanFileForComparisons(file);
      if (violations.length > 0) {
        console.error(`Found comparison formula in ${file}:`, violations);
      }
      expect(violations.length).toBe(0);
    }
  });
});
