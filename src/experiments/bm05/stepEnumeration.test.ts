import { describe, expect, test } from "bun:test";
import { enumerateSignedSteps } from "./stepEnumeration.ts";

describe("stepEnumeration experiment seam (am-bm-05-random-steps-ntzl)", () => {
  test("two independent signed steps enumerate all four outcomes behind the experiments seam", () => {
    const e = enumerateSignedSteps(2);
    expect(e.rows.length).toBe(4);
    expect(e.mean).toBe(0);
    expect(e.meanSquare).toBe(2);
    expect(e.meanCrossTerm).toBe(0);
    expect(e.meanAbsolute).toBe(1);
    for (const row of e.rows) {
      expect(row.square).toBe(row.sumSquares + row.crossTerm);
    }
  });

  test("dependent alternatives are evaluated behind the experiments seam", () => {
    const same = enumerateSignedSteps(2, "same-direction");
    const opposite = enumerateSignedSteps(2, "opposite-direction");
    expect(same.mean).toBe(0);
    expect(same.meanSquare).toBe(4);
    expect(same.meanCrossTerm).toBe(2);
    expect(opposite.mean).toBe(0);
    expect(opposite.meanSquare).toBe(0);
    expect(opposite.meanCrossTerm).toBe(-2);
  });

  test("refusals for out-of-domain steps and unknown models are preserved", () => {
    expect(() => enumerateSignedSteps(1)).toThrow();
    expect(() => enumerateSignedSteps(9)).toThrow();
    expect(() => enumerateSignedSteps(3, "same-direction")).toThrow();
  });
});
