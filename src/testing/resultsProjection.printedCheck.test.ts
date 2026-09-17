import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../physics/reference/diffusion/distributions.ts";
import {
  projectPrintedCheck,
  ResultsProjectionError,
} from "../reader/faces/results/resultsProjection.ts";
import { parsePrintedNumber } from "../testing/scenario-fixtures/evaluator.ts";
import { compareByKind } from "../testing/scenario-registry/compare.ts";

/**
 * am-read-results-face-uzh: printed checks show "the printed value, the stated inputs, the
 * reproduced value from the historical scenario, and the tolerance." A real historical fixture
 * exists at content/scenarios/diffusion-einstein-1905-printed.yaml for exactly this claim
 * ("about 0.8 Mikron" at T=290.15K, eta=0.00135 Pa s, a=5e-7 m, t=1s, its own declared constant
 * set) -- but resolving that set's declared R/N editorial inputs is scenario-registry-runner
 * plumbing (src/testing/scenario-registry/run.ts's private resolveSet), not this bead's scope.
 * This proves the projection mechanism itself against the same real owner chain
 * (stokesEinsteinD -> rmsDisplacement) and the same real parsePrintedNumber/compareByKind
 * helpers the scenario runner uses, under the registered modern-si-2019 set, and is honest that
 * wiring the full historical-set resolution is deferred.
 */
describe("resultsProjection.printedCheck: real owner chain, real printed-number parsing and comparison", () => {
  test("reproduces a printed micron value from stated T/eta/a/t through the real owner functions", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 293.15,
      eta = 0.001,
      a = 0.5e-6;
    const D = stokesEinsteinD({ T, eta, a }, set);
    if (D.result.status !== "value" || typeof D.result.value !== "number") {
      throw new Error("expected a number value");
    }
    const rms = rmsDisplacement(D.result.value, 1);
    if (rms.result.status !== "value" || typeof rms.result.value !== "number") {
      throw new Error("expected a number value");
    }

    const printedValue = "about 0,93 Mikron";
    const printed = parsePrintedNumber(printedValue);
    const verdict = compareByKind("tolerance", rms.result.value, printed, {
      tolerance: { relative: 0.02 },
    });

    const check = projectPrintedCheck({
      printedValue,
      statedInputs: { T: "293.15 K", eta: "0.001 Pa s", a: "0.5 um", t: "1 s" },
      constantSetId: set.id,
      scenarioId: "modern-golden-brownian-1s",
      reproducedValue: rms.result.value,
      tolerance: 0.02,
      comparisonKind: "tolerance",
      label: "modern comparison",
      transcriptionPending: false,
    });

    expect(verdict.ok).toBe(true);
    expect(check.reproducedValue).toBeCloseTo(rms.result.value, 12);
    expect(check.printedValue).toBe(printedValue);
    expect(check.label).toBe("modern comparison");
    expect(check.transcriptionPending).toBe(false);
  });

  test("the label vocabulary is free text, not a closed union -- both the bead's own single label and the Brownian-cards lane's four labels are accepted verbatim", () => {
    for (const label of [
      "as printed",
      "historical fixture",
      "modern constants, printed viscosity",
      "modern comparison",
    ]) {
      const check = projectPrintedCheck({
        printedValue: "0,8 Mikron",
        statedInputs: {},
        constantSetId: "modern-si-2019",
        scenarioId: "fixture",
        reproducedValue: 8e-7,
        tolerance: 0.05,
        comparisonKind: "rounds-to",
        label,
        transcriptionPending: false,
      });
      expect(check.label).toBe(label);
    }
  });

  test("a pending-transcription historical fixture is flagged rather than silently shown as reviewed", () => {
    // Mirrors content/scenarios/diffusion-einstein-1905-printed.yaml's own
    // transcription.status: pending -- the facsimile has not been reviewed in this repository.
    const check = projectPrintedCheck({
      printedValue: "0,8 Mikron",
      statedInputs: { T: "290.15 K", eta: "0.00135 Pa s", a: "5.0e-7 m", t: "1 s" },
      constantSetId: "scenario-einstein-1905-brownian-printed",
      scenarioId: "diffusion-einstein-1905-printed",
      reproducedValue: 7.9e-7,
      tolerance: 0.1,
      comparisonKind: "rounds-to",
      label: "historical fixture",
      transcriptionPending: true,
    });
    expect(check.transcriptionPending).toBe(true);
  });

  test("a nonfinite reproduced value is refused, never shown as NaN or Infinity", () => {
    expect(() =>
      projectPrintedCheck({
        printedValue: "0,8 Mikron",
        statedInputs: {},
        constantSetId: "modern-si-2019",
        scenarioId: "broken",
        reproducedValue: Number.NaN,
        tolerance: 0.05,
        comparisonKind: "tolerance",
        label: "as printed",
        transcriptionPending: false,
      }),
    ).toThrow(ResultsProjectionError);
  });
});
