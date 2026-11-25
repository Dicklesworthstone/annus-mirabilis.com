import { describe, expect, test } from "bun:test";
import {
  FLUX_BALANCE_PRESETS,
  type FluxBalance,
  type FluxBalanceInputs,
  fluxBalance,
  fluxBalanceDraft,
  INITIAL_FLUX_BALANCE,
  readFluxBalance,
} from "./fluxBalance.ts";

const INPUTS = { entering: 7, between: 4, leaving: 5, seconds: 1, area: 1 } as const;

function accepted(inputs: FluxBalanceInputs = INPUTS): FluxBalance {
  const result = fluxBalance(inputs);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(result.message);
  return result.balance;
}

describe("finite-region continuity from chosen particle counts", () => {
  test("the two local accounts and their combined account balance independently", () => {
    const balance = accepted();
    expect(balance.regions.left.finalCount).toBe(13);
    expect(balance.regions.right.finalCount).toBe(9);
    expect(balance.regions.whole.finalCount).toBe(22);
    expect(balance.regions.whole.initialCount).toBe(20);
    expect(balance.regions.whole.volume).toBe(2);
    expect(balance.regions.whole.initialConcentration).toBe(10);
    expect(balance.regions.whole.finalConcentration).toBe(11);
    expect(balance.regions.whole.concentrationRate).toBe(1);
    expect(balance.boundaryFluxes).toEqual([7, 4, 5]);
    expect(INITIAL_FLUX_BALANCE).toEqual({ kind: "accepted", balance });
  });

  test("moving the inner traffic changes local counts without changing any whole-region result", () => {
    const reference = accepted();
    const changed = accepted({ ...INPUTS, between: 7 });
    expect(changed.regions.left.finalCount).toBe(10);
    expect(changed.regions.right.finalCount).toBe(12);
    expect(changed.regions.whole).toEqual(reference.regions.whole);
    expect(changed.boundaryFluxes[1]).not.toBe(reference.boundaryFluxes[1]);
    expect(reference.regions.left.finalCount).toBe(13);
  });

  test("a steady stream and no crossings preserve the same concentration with different fluxes", () => {
    const stream = accepted({ ...INPUTS, entering: 5, between: 5, leaving: 5 });
    const still = accepted({ ...INPUTS, entering: 0, between: 0, leaving: 0 });
    for (const id of ["left", "right", "whole"] as const) {
      expect(stream.regions[id].change).toBe(0);
      expect(stream.regions[id].concentrationRate).toBe(0);
      expect(stream.regions[id].finalConcentration).toBe(still.regions[id].finalConcentration);
      expect(stream.regions[id].leftFlux).toBe(5);
      expect(still.regions[id].leftFlux).toBe(0);
    }
  });

  test("doubling area halves density and flux; doubling duration halves flux but preserves final density", () => {
    const reference = accepted();
    const wider = accepted({ ...INPUTS, area: 2 });
    const slower = accepted({ ...INPUTS, seconds: 2 });
    for (const id of ["left", "right", "whole"] as const) {
      expect(wider.regions[id].finalCount).toBe(reference.regions[id].finalCount);
      expect(wider.regions[id].finalConcentration).toBe(
        reference.regions[id].finalConcentration / 2,
      );
      expect(wider.regions[id].leftFlux).toBe(reference.regions[id].leftFlux / 2);
      expect(slower.regions[id].finalConcentration).toBe(reference.regions[id].finalConcentration);
      expect(slower.regions[id].leftFlux).toBe(reference.regions[id].leftFlux / 2);
      expect(slower.regions[id].concentrationRate).toBe(
        reference.regions[id].concentrationRate / 2,
      );
    }
  });

  test("the finite-volume balance includes losses and exact empty regions", () => {
    const empty = accepted({ ...INPUTS, entering: 0, between: 10, leaving: 20 });
    expect(empty.regions.left.finalCount).toBe(0);
    expect(empty.regions.right.finalCount).toBe(0);
    expect(empty.regions.whole.finalCount).toBe(0);
    expect(empty.regions.whole.concentrationRate).toBe(-10);
    let cases = 0;
    for (const entering of [0, 3, 7, 12]) {
      for (const between of [0, 5, 10]) {
        for (const leaving of [0, 4, 10]) {
          const value = accepted({ entering, between, leaving, seconds: 2.5, area: 1.25 });
          expect(value.regions.whole.finalCount).toBe(
            value.regions.left.finalCount + value.regions.right.finalCount,
          );
          for (const region of Object.values(value.regions)) {
            expect(region.concentrationRate).toBeCloseTo(region.negativeFluxGradient, 12);
            expect(region.finalCount).toBeGreaterThanOrEqual(0);
          }
          cases += 1;
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
  });

  test("impossible local counts are refused even when the combined count would remain nonnegative", () => {
    expect(fluxBalance({ ...INPUTS, entering: 0, between: 11, leaving: 0 })).toMatchObject({
      kind: "refused",
      field: "between",
    });
    expect(fluxBalance({ ...INPUTS, entering: 20, between: 0, leaving: 11 })).toMatchObject({
      kind: "refused",
      field: "leaving",
    });
  });

  test("count, time and area domains reject fractions, zero denominators and nonfinite values", () => {
    for (const field of ["entering", "between", "leaving"] as const) {
      for (const value of [-1, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY])
        expect(fluxBalance({ ...INPUTS, [field]: value })).toMatchObject({
          kind: "refused",
          field,
        });
    }
    for (const field of ["seconds", "area"] as const) {
      for (const value of [-1, 0, 1e-7, 101, Number.NaN, Number.POSITIVE_INFINITY])
        expect(fluxBalance({ ...INPUTS, [field]: value })).toMatchObject({
          kind: "refused",
          field,
        });
    }
  });

  test("typed input admits complete numbers, refuses partial expressions and never underflows a nonzero count to zero", () => {
    const draft = fluxBalanceDraft(accepted());
    expect(readFluxBalance({ ...draft, seconds: "2e0", area: " .5 " })).toMatchObject({
      kind: "accepted",
      balance: { inputs: { seconds: 2, area: 0.5 } },
    });
    for (const text of [
      "",
      " ",
      "-",
      "NaN",
      "Infinity",
      "1+1",
      "0x10",
      "1 second",
      "1e-999",
      "1".repeat(33),
    ]) {
      expect(readFluxBalance({ ...draft, entering: text })).toMatchObject({
        kind: "refused",
        field: "entering",
      });
    }
    expect(readFluxBalance({ ...draft, seconds: "−2" })).toMatchObject({
      kind: "refused",
      field: "seconds",
    });
  });

  test("presets stay valid and accepted records are immutable at every published level", () => {
    for (const preset of FLUX_BALANCE_PRESETS)
      expect(fluxBalance({ ...INPUTS, ...preset }).kind).toBe("accepted");
    const value = accepted();
    for (const object of [
      value,
      value.inputs,
      value.boundaryFluxes,
      value.regions,
      ...Object.values(value.regions),
    ])
      expect(Object.isFrozen(object)).toBe(true);
    expect(fluxBalance({ ...INPUTS, entering: -0 })).toMatchObject({
      kind: "accepted",
      balance: { inputs: { entering: 0 } },
    });
  });
});
