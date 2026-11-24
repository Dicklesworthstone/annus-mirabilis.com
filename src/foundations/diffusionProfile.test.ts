import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  DIFFUSION_PROFILE_SHAPES,
  type DiffusionProfileResult,
  diffusionProfile,
  doubleDiffusionProfile,
  INITIAL_DIFFUSION_PROFILE,
  readDiffusionProfile,
} from "./diffusionProfile.ts";

function accepted(result: DiffusionProfileResult) {
  assert(result.kind === "accepted", result.kind === "refused" ? result.message : "");
  return result.profile;
}

describe("a closed-tube diffusion foundation uses the conservative grid owner", () => {
  test("each shape keeps its amount, positivity and maximum principle across the control range", () => {
    for (const { id } of DIFFUSION_PROFILE_SHAPES) {
      for (const diffusivity of [0, 0.000001, 0.3, 1, 4]) {
        for (const minutes of [0, 0.000001, 0.0001, 0.1, 4, 16, 60]) {
          const view = accepted(diffusionProfile(diffusivity, minutes, id));
          expect(view.initialTotal).toBeCloseTo(18, 12);
          expect(view.total).toBeCloseTo(view.initialTotal, 11);
          expect(view.retainedPercent).toBeCloseTo(100, 10);
          expect(view.minimum).toBeGreaterThanOrEqual(view.initialMinimum - 1e-12);
          expect(view.maximum).toBeLessThanOrEqual(view.initialMaximum + 1e-12);
          for (const cell of view.cells) {
            expect(cell.current).toBeGreaterThanOrEqual(0);
            expect(cell.right - cell.left).toBe(view.cellWidth);
            expect(cell.centre).toBe((cell.left + cell.right) / 2);
          }
          expect(view.ownerId).toBe("diffusion.zeroFluxEvolution");
          expect(view.boundary).toBe("zero-flux");
          expect(view.referenceModel).toBe("continuous-time finite-volume grid");
        }
      }
    }
  });

  test("zero time, zero diffusivity and a uniform profile have no change", () => {
    for (const { id } of DIFFUSION_PROFILE_SHAPES) {
      for (const result of [diffusionProfile(4, 0, id), diffusionProfile(0, 60, id)]) {
        const view = accepted(result);
        expect(view.cells.map((cell) => cell.current)).toEqual(
          view.cells.map((cell) => cell.initial),
        );
      }
    }
    const uniform = accepted(diffusionProfile(4, 60, "uniform"));
    expect(uniform.cells.every((cell) => cell.current === 1)).toBe(true);
  });

  test("the original peak empties and dip fills, while long times approach the same mean", () => {
    const view = accepted(INITIAL_DIFFUSION_PROFILE);
    const peak = view.cells.find((cell) => cell.centre === 4.5);
    const dip = view.cells.find((cell) => cell.centre === 13.5);
    assert(peak && dip);
    expect(peak.current).toBeLessThan(peak.initial);
    expect(dip.current).toBeGreaterThan(dip.initial);
    for (const { id } of DIFFUSION_PROFILE_SHAPES) {
      const settled = accepted(diffusionProfile(4, 60, id));
      for (const cell of settled.cells) expect(Math.abs(cell.current - 1)).toBeLessThan(0.002);
    }
  });

  test("the short-time change matches local curvature and a reflecting end independently", () => {
    const initial = accepted(diffusionProfile(1, 0, "peak-dip"));
    const delta = 0.0001;
    const later = accepted(diffusionProfile(1, delta, "peak-dip"));
    // A cell gains from its neighbours and loses to them. At a sealed end there is one
    // neighbour, not a fictitious sink outside the tube.
    const density = initial.cells.map((cell) => cell.initial);
    for (const index of [0, 4, 13, 17]) {
      const centre = density[index];
      const observed = later.cells[index];
      assert(centre !== undefined && observed);
      const left = density[index - 1] ?? centre;
      const right = density[index + 1] ?? centre;
      const independentlyExpectedRate = left + right - 2 * centre;
      const observedRate = (observed.current - centre) / delta;
      expect(Math.abs(observedRate - independentlyExpectedRate)).toBeLessThan(0.00002);
    }
  });

  test("doubling D gives the same profile as doubling time with all other inputs held fixed", () => {
    for (const { id } of DIFFUSION_PROFILE_SHAPES) {
      const view = accepted(diffusionProfile(1, 4, id));
      const faster = accepted(doubleDiffusionProfile(view, "diffusivity"));
      const longer = accepted(doubleDiffusionProfile(view, "minutes"));
      expect(faster.diffusivity).toBe(2);
      expect(faster.minutes).toBe(4);
      expect(longer.diffusivity).toBe(1);
      expect(longer.minutes).toBe(8);
      expect(faster.cells).toEqual(longer.cells);
      expect(faster.maximum).toBe(longer.maximum);
      expect(faster.total).toBe(longer.total);
    }
  });

  test("snapshots are deeply immutable and later calculations cannot alias their cells", () => {
    const first = accepted(INITIAL_DIFFUSION_PROFILE);
    const saved = JSON.stringify(first);
    const next = accepted(diffusionProfile(2, 8, "step"));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.cells)).toBe(true);
    expect(first.cells.every(Object.isFrozen)).toBe(true);
    expect(next.cells).not.toBe(first.cells);
    expect(JSON.stringify(first)).toBe(saved);
  });

  test("typed input refuses expressions, partial tokens, overflow, underflow and invalid ranges", () => {
    for (const value of [
      "",
      "-",
      "NaN",
      "Infinity",
      "1e400",
      "1e-999",
      "0x1",
      "1+1",
      "1 mm",
      "1".repeat(33),
    ]) {
      const result = readDiffusionProfile(value, "4", "peak-dip");
      expect(result.kind).toBe("refused");
      if (result.kind === "refused") expect(result.field).toBe("diffusivity");
    }
    for (const [diffusivity, minutes, field] of [
      [-1, 4, "diffusivity"],
      [4.1, 4, "diffusivity"],
      [0.0000001, 4, "diffusivity"],
      [1, -1, "minutes"],
      [1, 61, "minutes"],
      [1, 0.0000001, "minutes"],
      [1, Number.NaN, "minutes"],
    ] as const) {
      const result = diffusionProfile(diffusivity, minutes, "step");
      expect(result.kind).toBe("refused");
      if (result.kind === "refused") expect(result.field).toBe(field);
    }
    expect(diffusionProfile(1, 4, "unknown").kind).toBe("refused");
    const normalized = accepted(readDiffusionProfile("−0", " 4e0 ", "step"));
    expect(Object.is(normalized.diffusivity, -0)).toBe(false);
    expect(normalized.minutes).toBe(4);
    expect(doubleDiffusionProfile(accepted(diffusionProfile(4, 60, "step")), "minutes").kind).toBe(
      "refused",
    );
  });
});
