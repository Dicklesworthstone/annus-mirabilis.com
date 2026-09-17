import { describe, expect, it } from "bun:test";
import { classifyWithTolerance, compareBitwise, roundsTo, withinTolerance } from "./tolerance.ts";
import {
  formatBitwiseVerdict,
  formatClassificationVerdict,
  formatRoundsToVerdict,
  formatToleranceVerdict,
} from "./verdictText.ts";

describe("Verdict Text Formatting (am-ver-precision-display-5e5)", () => {
  it("formats within and outside tolerance verdicts", () => {
    const vWithin = withinTolerance(1.001, 1.0, { absolute: 0.01 });
    expect(formatToleranceVerdict(vWithin)).toContain("within tolerance");

    const vOutside = withinTolerance(1.05, 1.0, { absolute: 0.01 });
    expect(formatToleranceVerdict(vOutside)).toContain("outside tolerance");

    const vInvalid = withinTolerance(1.0, 1.0, {});
    expect(formatToleranceVerdict(vInvalid)).toContain("invalid tolerance specification");
  });

  it("formats bitwise verdicts", () => {
    const vMatch = compareBitwise(42, 42);
    expect(formatBitwiseVerdict(vMatch)).toContain("exact bitwise match");

    const vMismatch = compareBitwise(42, 43);
    expect(formatBitwiseVerdict(vMismatch)).toContain("bitwise mismatch");
  });

  it("formats sign classification verdicts including indeterminate", () => {
    const vIndet = classifyWithTolerance(0.005, { absolute: 0.01 });
    expect(formatClassificationVerdict(vIndet)).toContain("indeterminate within band");

    const vPos = classifyWithTolerance(5.0, { absolute: 0.01 });
    expect(formatClassificationVerdict(vPos)).toBe("positive");

    const vZero = classifyWithTolerance(0, { absolute: 0, relative: 0 });
    expect(formatClassificationVerdict(vZero)).toBe("exact zero");
  });

  it("formats rounds-to verdicts", () => {
    const vRounds = roundsTo(0.79478, 0.8, { significantFigures: 1 }, "half-up");
    expect(formatRoundsToVerdict(vRounds)).toContain("rounds to 0.8");
  });
});
