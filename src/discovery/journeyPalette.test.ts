import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverInlineViews } from "./journeyFormulaList.ts";

/**
 * Every quantity a Discover formula binds is coloured in its paper (dispatch 276). A bound term
 * takes its tint from src/generated/quantity-colours-by-paper.css, one rule per paper and quantity,
 * which scripts/build-equations.ts writes for the quantities its views name. Until the Discover
 * formulas were among those views, six of their quantities had no rule and were marked but drawn
 * in the neutral ink: light quanta's quantumEnergy, mass-energy's bodyMass, and relativity's four
 * ansatz coefficients.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(join(root, "src/generated/quantity-colours-by-paper.css"), "utf8");

describe("the Discover formulas' colours", () => {
  test("every quantity a Discover formula binds has its paper's colour rule", () => {
    const pairs = [
      ...new Set(
        discoverInlineViews().flatMap((v) => v.terms.map((t) => `${v.paper} ${t.quantityId}`)),
      ),
    ];
    // Non-vacuity: the four papers' journeys and investigations bind dozens of quantities.
    expect(pairs.length).toBeGreaterThan(30);
    const missing = pairs.filter((pair) => {
      const [paper, quantityId] = pair.split(" ");
      return !css.includes(`[data-paper="${paper}"] [data-quantity-id="${quantityId}"] { --qc:`);
    });
    expect(missing).toEqual([]);
  });
});
