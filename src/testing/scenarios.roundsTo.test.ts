import { describe, expect, test } from "bun:test";
import { roundingInterval, roundsTo } from "../units/tolerance.ts";

describe("roundingInterval (requirement 9 table)", () => {
  test("0,8 Mikron at 1 sf is [0.75, 0.85) um and 0.7947833 um lies inside", () => {
    const interval = roundingInterval(0.8, { significantFigures: 1 });
    expect(interval.low).toBeCloseTo(0.75, 12);
    expect(interval.high).toBeCloseTo(0.85, 12);
    expect(roundsTo(0.7947833, 0.8, { significantFigures: 1 }).ok).toBe(true);
  });

  test("ca. 6 Mikron at 1 sf is [5.5, 6.5) and both printed-set and modern-kb values lie inside", () => {
    const interval = roundingInterval(6, { significantFigures: 1 });
    expect(interval.low).toBe(5.5);
    expect(interval.high).toBe(6.5);
    expect(roundsTo(6.156365, 6, { significantFigures: 1 }).ok).toBe(true);
    expect(roundsTo(6.146687, 6, { significantFigures: 1 }).ok).toBe(true);
  });

  test("6.16 um at 3 sf is [6.155, 6.165)", () => {
    const interval = roundingInterval(6.16, { significantFigures: 3 });
    expect(interval.low).toBeCloseTo(6.155, 12);
    expect(interval.high).toBeCloseTo(6.165, 12);
    expect(roundsTo(6.156365, 6.16, { significantFigures: 3 }).ok).toBe(true);
  });

  test("4.3 V at 2 sf is [4.25, 4.35) and 4.338 V lies inside", () => {
    const interval = roundingInterval(4.3, { significantFigures: 2 });
    expect(interval.low).toBeCloseTo(4.25, 12);
    expect(interval.high).toBeCloseTo(4.35, 12);
    expect(roundsTo(4.338, 4.3, { significantFigures: 2 }).ok).toBe(true);
  });

  test("6.17e23 at 3 sf is [6.165e23, 6.175e23)", () => {
    const interval = roundingInterval(6.17e23, { significantFigures: 3 });
    expect(interval.low).toBeCloseTo(6.165e23, 6);
    expect(interval.high).toBeCloseTo(6.175e23, 6);
    expect(roundsTo(6.170486e23, 6.17e23, { significantFigures: 3 }).ok).toBe(true);
  });

  test("half-open: the lower bound passes and one ulp below it fails", () => {
    const low = roundingInterval(0.8, { significantFigures: 1 }).low;
    expect(roundsTo(low, 0.8, { significantFigures: 1 }).ok).toBe(true);
    expect(roundsTo(low - 1e-15, 0.8, { significantFigures: 1 }).ok).toBe(false);
  });

  test("decimals form uses step 10^(-n)", () => {
    const interval = roundingInterval(4.3, { decimals: 1 });
    expect(interval.step).toBeCloseTo(0.1, 12);
    expect(interval.low).toBeCloseTo(4.25, 12);
  });

  test("the adversarial 1 um value 0.562 um is outside [0.75, 0.85)", () => {
    const verdict = roundsTo(0.562, 0.8, { significantFigures: 1 });
    expect(verdict.ok).toBe(false);
    expect(verdict.interval.low).toBeCloseTo(0.75, 12);
    expect(verdict.interval.high).toBeCloseTo(0.85, 12);
  });
});
