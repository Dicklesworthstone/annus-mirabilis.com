import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { strictParse } from "../content/schemas/strictParse.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  PRINTED_RELATIONS_METADATA,
  threePrintedRelations,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

function val(r: ScientificResult): number {
  if (r.status !== "value") {
    throw new Error(`expected value result, got ${r.status}`);
  }
  if (typeof r.value !== "number") {
    throw new Error(`expected number, got ${typeof r.value}`);
  }
  return r.value;
}

describe("electron.relations.test.ts: Transcribed printed relations and modern equivalents (AC6)", () => {
  test("the three printed relations match their actual source records and page locators", () => {
    const t0 = performance.now();
    expect(PRINTED_RELATIONS_METADATA.map((relation) => relation.id)).toEqual([
      "deflectability-ratio",
      "potential-difference",
      "magnetic-deflection",
    ]);
    for (const relation of PRINTED_RELATIONS_METADATA) {
      const block = strictParse(
        readFileSync(
          new URL(
            `../../content/source-blocks/special-relativity/${relation.sourceBlock}.yaml`,
            import.meta.url,
          ),
          "utf8",
        ),
        "yaml",
      ) as { id: string; diplomaticText: string; locators: { printedPage: number }[] };
      expect(block.id).toBe(relation.sourceBlock);
      expect(relation.printedForm).toBe(block.diplomaticText);
      expect(relation.locator).toBe(`p. ${block.locators[0]?.printedPage}`);
    }
    // The electric-radius comparison is useful, but it is not one of Einstein's
    // three closing experimental relations and must not acquire a fictitious source.
    expect(PRINTED_RELATIONS_METADATA.some((relation) => /R_e/.test(relation.printedForm))).toBe(
      false,
    );

    logElectron({
      testId: "electron-relations-source-locators",
      resultStatus: "value",
      expected: "source records eq-s10-d9, eq-s10-d10, eq-s10-d12",
      actual: PRINTED_RELATIONS_METADATA.map((relation) => relation.sourceBlock).join(", "),
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Printed forms and page locators agree with the edition's source ledger; no new review status is claimed.",
    });
  });

  test("three printed relations and the separate electric comparison reproduce their modern equivalents", () => {
    const t0 = performance.now();
    const speeds = [0.1, 0.3, 0.6, 0.8];
    const eField = 1e5;
    const bField = 0.01;

    for (const beta of speeds) {
      const rel = threePrintedRelations(beta, eField, bField);
      expect(rel.deflectabilityRatio.status).toBe("value");
      expect(withinTolerance(val(rel.deflectabilityRatio), beta, { relative: 1e-12 }).ok).toBe(
        true,
      );

      const gammaVal = 1 / Math.sqrt(1 - beta * beta);
      const v = beta * C_SI;

      // Accelerating potential P = mc^2(gamma - 1) / e
      const expectedP = (ELECTRON_MASS * C_SI * C_SI * (gammaVal - 1)) / ELEMENTARY_CHARGE;
      expect(withinTolerance(val(rel.potentialDifference), expectedP, { relative: 1e-10 }).ok).toBe(
        true,
      );

      // Magnetic radius Rm = gamma * m * v / (e * B)
      const expectedRm = (gammaVal * ELECTRON_MASS * v) / (ELEMENTARY_CHARGE * bField);
      expect(withinTolerance(val(rel.magneticRadius), expectedRm, { relative: 1e-10 }).ok).toBe(
        true,
      );

      // Additional modern comparison, not a fourth printed relation: Re = gamma * m * v^2 / (e * E)
      const expectedRe = (gammaVal * ELECTRON_MASS * v * v) / (ELEMENTARY_CHARGE * eField);
      expect(withinTolerance(val(rel.electricRadius), expectedRe, { relative: 1e-10 }).ok).toBe(
        true,
      );
    }

    logElectron({
      testId: "electron-relations-modern-equivalents",
      resultStatus: "value",
      expected: "reproduced",
      actual: "reproduced",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Printed relations match modern formula predictions across sampled speeds.",
    });
  });
});
