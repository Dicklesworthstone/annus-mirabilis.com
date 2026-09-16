import { afterAll, describe, expect, it } from "bun:test";
import {
  AUTHORED_BROWNIAN_DISPLACEMENTS,
  calculateSignedDisplacements,
  DOUBLED_BROWNIAN_DISPLACEMENTS,
  describeDisplacementInWords,
  formatSignedDisplacement,
  scaleDisplacements,
} from "../../reader/entrances/signedDisplacements.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Signed Displacements Arithmetic Engine (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  it("calculates totals for the authored example [-3, -1, +1, +3]", () => {
    const start = performance.now();
    const totals = calculateSignedDisplacements(AUTHORED_BROWNIAN_DISPLACEMENTS);

    expect(totals.count).toBe(4);
    expect(totals.signedSum).toBe(0);
    expect(totals.meanSigned).toBe(0);
    expect(totals.meanAbsolute).toBe(2);
    expect(totals.meanSquare).toBe(5);
    expect(totals.rootMeanSquare).toBeCloseTo(2.236068, 5);

    logger.log({
      testId: "signed-displacements-authored-example",
      beadId: BEAD_ID,
      expected: { signedSum: 0, meanAbsolute: 2, meanSquare: 5, rootMeanSquare: Math.sqrt(5) },
      actual: totals,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-5 },
      extra: {
        interface: "table",
        entries: [...AUTHORED_BROWNIAN_DISPLACEMENTS],
        totals,
      },
    });
  });

  it("calculates totals for the doubled example [-6, -2, +2, +6]", () => {
    const start = performance.now();
    const doubled = scaleDisplacements(AUTHORED_BROWNIAN_DISPLACEMENTS, 2);
    expect(doubled).toEqual(DOUBLED_BROWNIAN_DISPLACEMENTS);

    const totals = calculateSignedDisplacements(doubled);
    expect(totals.count).toBe(4);
    expect(totals.signedSum).toBe(0);
    expect(totals.meanSigned).toBe(0);
    expect(totals.meanAbsolute).toBe(4);
    expect(totals.meanSquare).toBe(20);
    expect(totals.rootMeanSquare).toBeCloseTo(4.472136, 5);

    logger.log({
      testId: "signed-displacements-doubled-example",
      beadId: BEAD_ID,
      expected: { signedSum: 0, meanAbsolute: 4, meanSquare: 20, rootMeanSquare: Math.sqrt(20) },
      actual: totals,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-5 },
      extra: {
        interface: "table",
        entries: [...doubled],
        totals,
      },
    });
  });

  it("calculates totals for the edited set [-2, 0, 1, 5]", () => {
    const start = performance.now();
    const edited = [-2, 0, 1, 5];
    const totals = calculateSignedDisplacements(edited);

    expect(totals.count).toBe(4);
    expect(totals.signedSum).toBe(4);
    expect(totals.meanSigned).toBe(1);
    expect(totals.meanAbsolute).toBe(2);
    expect(totals.meanSquare).toBe(7.5);
    expect(totals.rootMeanSquare).toBeCloseTo(Math.sqrt(7.5), 6);

    logger.log({
      testId: "signed-displacements-edited-set",
      beadId: BEAD_ID,
      expected: {
        signedSum: 4,
        meanSigned: 1,
        meanAbsolute: 2,
        meanSquare: 7.5,
        rootMeanSquare: Math.sqrt(7.5),
      },
      actual: totals,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-5 },
      extra: {
        interface: "table",
        entries: edited,
        totals,
      },
    });
  });

  it("handles non-integers cleanly", () => {
    const nonIntegers = [-1.5, -0.5, 0.5, 1.5];
    const totals = calculateSignedDisplacements(nonIntegers);

    expect(totals.count).toBe(4);
    expect(totals.signedSum).toBe(0);
    expect(totals.meanSigned).toBe(0);
    expect(totals.meanAbsolute).toBe(1);
    expect(totals.meanSquare).toBe(1.25);
    expect(totals.rootMeanSquare).toBeCloseTo(Math.sqrt(1.25), 6);
  });

  it("normalizes negative zero (-0) correctly", () => {
    const withNegZero = [-0, 0, -1, 1];
    const totals = calculateSignedDisplacements(withNegZero);

    expect(Object.is(totals.signedSum, -0)).toBe(false);
    expect(totals.signedSum).toBe(0);
    expect(totals.meanSigned).toBe(0);
    expect(totals.meanAbsolute).toBe(0.5);
  });

  it("formats signed displacements with + and - signs", () => {
    expect(formatSignedDisplacement(3)).toBe("+3");
    expect(formatSignedDisplacement(-3)).toBe("-3");
    expect(formatSignedDisplacement(0)).toBe("0");
    expect(formatSignedDisplacement(-0)).toBe("0");
  });

  it("describes displacements in plain words", () => {
    expect(describeDisplacementInWords(3)).toBe("three steps right");
    expect(describeDisplacementInWords(-3)).toBe("three steps left");
    expect(describeDisplacementInWords(1)).toBe("one step right");
    expect(describeDisplacementInWords(-1)).toBe("one step left");
    expect(describeDisplacementInWords(0)).toBe("at the starting point");
  });

  it("handles empty array gracefully", () => {
    const totals = calculateSignedDisplacements([]);
    expect(totals.count).toBe(0);
    expect(totals.signedSum).toBe(0);
    expect(totals.meanSigned).toBe(0);
    expect(totals.meanAbsolute).toBe(0);
    expect(totals.meanSquare).toBe(0);
    expect(totals.rootMeanSquare).toBe(0);
  });
});
