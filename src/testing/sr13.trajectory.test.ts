import { describe, expect, test } from "bun:test";
import { SR13_DEFAULTS, type Sr13Parameters } from "../experiments/sr13/definition.ts";
import { createSr13Session, sr13InputFromParameters } from "../experiments/sr13/session.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  evaluateSr13,
  integrateBoris,
  SR13_TRAJECTORY_STEPS,
} from "../physics/reference/electron.ts";

/**
 * SR-13 publishes the electron's path (am-sr-13-electron-dynamics-b6v7). The chamber drawing used to
 * invent its curve from made-up factors, and it bent an electron the same way in a magnetic field as
 * in an electric one: in the crossed-field preset the magnetic push, ev B = 1.8 × 10⁶ e N at 0.6c and
 * 0.01 T, outweighs the electric eE = 10⁵ e N and points the other way, so the drawn path bent the
 * wrong way. These are properties of the published path, not a census of its points.
 */

function path(overrides: Partial<Sr13Parameters>) {
  const out = evaluateSr13(sr13InputFromParameters({ ...SR13_DEFAULTS, ...overrides }));
  const r = out.trajectoryPositions;
  if (r?.status !== "value" || !(r.value instanceof Float64Array)) {
    throw new Error(`expected a published path, got ${r?.status}`);
  }
  const v = r.value;
  const n = v.length / 2;
  return {
    n,
    x: (i: number) => v[2 * i] as number,
    y: (i: number) => v[2 * i + 1] as number,
    outputs: out,
  };
}

describe("SR-13 trajectory output", () => {
  test("the path starts at the origin and holds one position per step, plus the start", () => {
    const p = path({});
    expect(p.n).toBe(SR13_TRAJECTORY_STEPS + 1);
    expect(p.x(0)).toBe(0);
    expect(p.y(0)).toBe(0);
  });

  test("an electric field along +y pushes the electron toward -y", () => {
    const p = path({ electricFieldY: 1e5, magneticFieldZ: 0 });
    expect(p.x(p.n - 1)).toBeGreaterThan(0);
    expect(p.y(p.n - 1)).toBeLessThan(0);
  });

  test("a magnetic field along +z bends an electron moving along +x toward +y, on a circle of the published radius", () => {
    const p = path({ electricFieldY: 0, magneticFieldZ: 0.01 });
    expect(p.y(p.n - 1)).toBeGreaterThan(0);
    const radius = p.outputs.radiusCurvatureMagnetic;
    if (radius?.status !== "value" || typeof radius.value !== "number") {
      throw new Error("expected a magnetic radius");
    }
    const r = radius.value;
    // q v × B for q < 0, v along +x, B along +z points along +y: the centre is at (0, +r). The
    // integrator advances each position with the step's closing velocity, which shifts the circle's
    // centre by about r·Δθ/2, Δθ = 0.023 rad per step at these settings: measured, the worst point
    // sits 1.2% of r off the exact circle. The tolerance, 2% of r, is about 3 px on the chamber
    // drawing; a path bent the wrong way, or on another radius, misses it by the order of r.
    for (let i = 0; i < p.n; i++) {
      expect(Math.abs(Math.hypot(p.x(i), p.y(i) - r) - r)).toBeLessThan(0.02 * r);
    }
    // And the arc turns over: 2 ns at 0.6c is 2.8 radians of a 12.8 cm circle, so the path rises
    // past one radius toward the top of the circle.
    let top = 0;
    for (let i = 0; i < p.n; i++) top = Math.max(top, p.y(i));
    expect(top).toBeGreaterThan(r);
  });

  test("in the crossed-field preset the magnetic push wins and the electron bends toward +y", () => {
    const p = path({ initialSpeed: 0.6, electricFieldY: 1e5, magneticFieldZ: 0.01 });
    expect(p.y(p.n - 1)).toBeGreaterThan(0);
  });

  test("a negative initial speed sends the electron along -x", () => {
    const p = path({ initialSpeed: -0.6, electricFieldY: 0, magneticFieldZ: 0 });
    expect(p.x(p.n - 1)).toBeLessThan(0);
    expect(Math.abs(p.y(p.n - 1))).toBeLessThan(1e-12);
  });

  test("a superluminal request publishes no path", () => {
    const out = evaluateSr13(sr13InputFromParameters({ ...SR13_DEFAULTS, initialSpeed: 1.2 }));
    expect(out.trajectoryPositions?.status).toBe("outside-domain");
  });

  test("the session accepts the path under its output contract", () => {
    const session = createSr13Session("test-sr13-trajectory");
    const applied = session.apply({ ...SR13_DEFAULTS, magneticFieldZ: 0.01 });
    expect(applied.kind).toBe("accepted");
    const out = session
      .getSnapshot()
      .accepted?.outputs.find((o) => o.quantityId === "trajectoryPositions");
    expect(out?.status).toBe("value");
    if (out?.status !== "value" || typeof out.value === "number")
      throw new Error("expected a path");
    expect(out.value.length).toBe(2 * (SR13_TRAJECTORY_STEPS + 1));
  });
});

/** The exact path of a charge released at speed v0 along x into a uniform field E along y. */
function exactUniformE(t: number, E: number, v0: number) {
  const q = -ELEMENTARY_CHARGE;
  const g0 = 1 / Math.sqrt(1 - (v0 / C_SI) ** 2);
  const px = g0 * ELECTRON_MASS * v0;
  const E0 = g0 * ELECTRON_MASS * C_SI ** 2;
  const F = q * E;
  return {
    x: ((px * C_SI) / Math.abs(F)) * Math.asinh((C_SI * Math.abs(F) * t) / E0),
    y: (Math.sqrt(E0 ** 2 + (C_SI * F * t) ** 2) - E0) / F,
  };
}

describe("SR-13's path agrees with the exact uniform-field solution", () => {
  test("the default path ends at the bead's reference point, x = 0.359225 m and y = -0.0280794 m", () => {
    // Before the leapfrog staggering the integrator ended at y = -0.0283129 m, 0.83% off, because
    // position and momentum started at the same instant (a first-order error at 120 steps).
    const p = path({});
    const exact = exactUniformE(SR13_DEFAULTS.integrationInterval, 1e5, 0.6 * C_SI);
    expect(exact.x).toBeCloseTo(0.359225, 6);
    expect(exact.y).toBeCloseTo(-0.0280794, 7);
    expect(Math.abs(p.x(p.n - 1) / exact.x - 1)).toBeLessThan(1e-6);
    expect(Math.abs(p.y(p.n - 1) / exact.y - 1)).toBeLessThan(1e-6);
  });

  test("the first step deflects by exactly half the acceleration times the step squared", () => {
    const p = path({});
    const dt = SR13_DEFAULTS.integrationInterval / SR13_TRAJECTORY_STEPS;
    const a = (-ELEMENTARY_CHARGE * 1e5) / ((1 / Math.sqrt(1 - 0.36)) * ELECTRON_MASS);
    expect(p.y(1) / (0.5 * a * dt * dt)).toBeCloseTo(1, 6);
  });

  test("the error falls about fourfold when the step is halved, as a second-order method's must", () => {
    const run = (steps: number) => {
      const r = integrateBoris(
        { x: 0, y: 1e5, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0.6 * C_SI, y: 0, z: 0 },
        2e-9,
        steps,
      );
      const end = r.points[r.points.length - 1];
      if (!end) throw new Error("the integrator returned no points");
      return Math.abs(end.y - exactUniformE(2e-9, 1e5, 0.6 * C_SI).y);
    };
    const ratio = run(60) / run(120);
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
  });
});
