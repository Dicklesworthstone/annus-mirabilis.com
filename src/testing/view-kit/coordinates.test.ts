import { describe, expect, test } from "bun:test";
import {
  createLinearProjector,
  createLogProjector,
  generateLinearTicks,
  generateLogTicks,
} from "../../visuals/kit/coordinates.ts";

describe("coordinates and projectors (am-inst-2d-view-kit-u75r)", () => {
  test("linear projector maps domain to range continuously and inverts accurately", () => {
    const proj = createLinearProjector({ domain: [0, 10], range: [100, 500] });

    expect(proj(0)).toBe(100);
    expect(proj(5)).toBe(300);
    expect(proj(10)).toBe(500);

    expect(proj.invert(100)).toBe(0);
    expect(proj.invert(300)).toBe(5);
    expect(proj.invert(500)).toBe(10);
  });

  test("linear projector supports clamping", () => {
    const proj = createLinearProjector({ domain: [0, 10], range: [0, 100], clamp: true });

    expect(proj(-5)).toBe(0);
    expect(proj(15)).toBe(100);
  });

  test("linear projector rejects degenerate domain", () => {
    expect(() => createLinearProjector({ domain: [5, 5], range: [0, 100] })).toThrow();
  });

  test("logarithmic projector maps positive domain and inverts accurately", () => {
    const proj = createLogProjector({ domain: [1, 1000], range: [0, 300], base: 10 });

    expect(proj(1)).toBe(0);
    expect(proj(10)).toBeCloseTo(100, 5);
    expect(proj(100)).toBeCloseTo(200, 5);
    expect(proj(1000)).toBeCloseTo(300, 5);

    expect(proj.invert(0)).toBeCloseTo(1, 5);
    expect(proj.invert(100)).toBeCloseTo(10, 5);
    expect(proj.invert(200)).toBeCloseTo(100, 5);
    expect(proj.invert(300)).toBeCloseTo(1000, 5);
  });

  test("logarithmic projector rejects non-positive domain", () => {
    expect(() => createLogProjector({ domain: [0, 100], range: [0, 100] })).toThrow();
    expect(() => createLogProjector({ domain: [-10, 100], range: [0, 100] })).toThrow();
  });

  test("linear tick generation produces well-spaced ticks", () => {
    const proj = createLinearProjector({ domain: [0, 100], range: [0, 500] });
    const ticks = generateLinearTicks(proj, 5);

    expect(ticks.length).toBeGreaterThanOrEqual(4);
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    if (!first || !last) throw new Error("Expected ticks");
    expect(first.value).toBe(0);
    expect(last.value).toBe(100);
    expect(first.position).toBe(0);
  });

  test("logarithmic tick generation produces decade ticks", () => {
    const proj = createLogProjector({ domain: [1, 10000], range: [0, 400] });
    const ticks = generateLogTicks(proj, 10);

    expect(ticks.map((t) => t.value)).toEqual([1, 10, 100, 1000, 10000]);
    expect(ticks.map((t) => t.label)).toEqual(["10^0", "10^1", "10^2", "10^3", "10^4"]);
  });
});
