import { describe, expect, test } from "bun:test";
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
  test("transcribed relations match facsimile with page locators (AC6)", () => {
    const t0 = performance.now();
    expect(PRINTED_RELATIONS_METADATA.length).toBe(3);

    const potRel = PRINTED_RELATIONS_METADATA.find((r) => r.id === "potential-difference");
    expect(potRel).toBeDefined();
    expect(potRel?.locator).toBe("p. 920");
    expect(potRel?.printedForm).toContain("P = \\int X dx");

    const magRel = PRINTED_RELATIONS_METADATA.find((r) => r.id === "magnetic-deflection");
    expect(magRel).toBeDefined();
    expect(magRel?.locator).toBe("p. 920");
    expect(magRel?.printedForm).toContain("R_m = ");

    const elRel = PRINTED_RELATIONS_METADATA.find((r) => r.id === "electric-deflection");
    expect(elRel).toBeDefined();
    expect(elRel?.locator).toBe("p. 921");
    expect(elRel?.printedForm).toContain("R_e = ");

    logElectron({
      testId: "electron-relations-facsimile-locators",
      resultStatus: "value",
      expected: 3,
      actual: PRINTED_RELATIONS_METADATA.length,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Three relations transcribed from facsimile with exact page locators p. 920 and p. 921.",
    });
  });

  test("three printed relations reproduce modern equivalents across sampled speeds", () => {
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

      // Electric radius Re = gamma * m * v^2 / (e * E)
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
