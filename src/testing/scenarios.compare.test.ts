import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareByKind } from "./scenario-registry/compare.ts";

describe("scenario compare dispatch", () => {
  test("bitwise, tolerance, and rounds-to all go through src/units/tolerance.ts", () => {
    expect(compareByKind("bitwise", 1, 1).ok).toBe(true);
    expect(compareByKind("bitwise", 1, 2).ok).toBe(false);
    expect(compareByKind("tolerance", 1.0000000001, 1, { tolerance: { relative: 1e-8 } }).ok).toBe(
      true,
    );
    expect(
      compareByKind("rounds-to", 0.7947833e-6, 0.8e-6, {
        printedValue: 0.8e-6,
        printedPrecision: { significantFigures: 1 },
      }).ok,
    ).toBe(true);
  });

  test("the registry implements no second comparison routine", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "scenario-registry");
    for (const name of ["compare.ts", "run.ts", "discrimination.ts", "editorialInputs.ts"]) {
      const text = readFileSync(join(dir, name), "utf8");
      expect(text.includes("export function roundsTo")).toBe(false);
      expect(text.includes("export function withinTolerance")).toBe(false);
      expect(text.includes("export function compareBitwise")).toBe(false);
    }
  });
});
