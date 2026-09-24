import { describe, expect, test } from "bun:test";
import { SR02_DEFAULTS } from "../experiments/sr02/definition.ts";
import { sr02InputFromParameters } from "../experiments/sr02/parameters.ts";
import {
  ALONG_MOTION_ZERO_REASON,
  C_SI,
  evaluateSr02,
  PATH_REFUSAL_REASON,
} from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * With v along x and B along z the force per unit charge, v × B, points along −y. A straight
 * segment along the motion therefore gets no work from it: its electromotive force is zero in the
 * magnet frame, and in the conductor frame too, where E′ is along y, whatever slice fixes its ends.
 * The owner used to report |v B l| for either orientation, and with the slice declared a ratio of
 * γ for the boost-parallel segment, which am-sr-02-magnet-conductor-x1gc's adversarial fixture
 * says must fail.
 */
const at = (overrides: Partial<typeof SR02_DEFAULTS>) =>
  evaluateSr02(sr02InputFromParameters({ ...SR02_DEFAULTS, ...overrides }));
const value = (r: { status: string; value?: unknown }) =>
  r.status === "value" && typeof r.value === "number" ? r.value : Number.NaN;
const close = (a: number, b: number) => withinTolerance(a, b, { relative: 1e-12 }).ok;

describe("SR-02: a path along the motion has zero electromotive force in both frames", () => {
  for (const [label, speed] of [
    ["10 m/s", 10],
    ["0.6c", 0.6 * C_SI],
  ] as const) {
    for (const fieldModel of ["uniform", "dipole"] as const) {
      test(`magnet frame, ${fieldModel}, ${label}: zero along the motion, nonzero across it`, () => {
        const along = at({ speed, fieldModel, pathOrientation: "along-motion" });
        expect(along.emfMagnet.status).toBe("value");
        expect(value(along.emfMagnet)).toBe(0);
        const across = at({ speed, fieldModel, pathOrientation: "transverse" });
        expect(value(across.emfMagnet)).toBeGreaterThan(0);
      });
    }
  }

  test("without a declared slice the along-motion comparison is still refused", () => {
    const snap = at({ speed: 0.6 * C_SI, pathOrientation: "along-motion" });
    expect(snap.emfConductor.status).toBe("not-applicable");
    if (snap.emfConductor.status === "not-applicable") {
      expect(snap.emfConductor.reason).toBe(PATH_REFUSAL_REASON);
    }
  });

  test("with the slice declared both are zero and no ratio of γ is published", () => {
    const snap = at({ speed: 0.6 * C_SI, pathOrientation: "along-motion", sliceDeclared: true });
    expect(value(snap.emfMagnet)).toBe(0);
    expect(snap.emfConductor.status).toBe("value");
    expect(value(snap.emfConductor)).toBe(0);
    expect(snap.emfExcess.status).toBe("not-applicable");
    if (snap.emfExcess.status === "not-applicable") {
      expect(snap.emfExcess.reason).toBe(ALONG_MOTION_ZERO_REASON);
    }
  });

  test("the transverse numbers are unchanged: 1 V at 10 m/s, a ratio of 1.25 at 0.6c", () => {
    const slow = at({ speed: 10, magneticField: 1, segmentLength: 0.1 });
    expect(close(value(slow.emfMagnet), 1)).toBe(true);
    const fast = at({ speed: 0.6 * C_SI, magneticField: 1, segmentLength: 0.1 });
    expect(close(value(fast.emfConductor) / value(fast.emfMagnet), 1.25)).toBe(true);
    expect(close(value(fast.emfExcess), 0.25)).toBe(true);
  });
});
