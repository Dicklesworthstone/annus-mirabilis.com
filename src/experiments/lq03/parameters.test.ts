import { describe, expect, test } from "bun:test";
import { LQ03_DEFAULTS } from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";

describe("validateLq03Parameters: out-of-domain input explains, never silently clamps (am-lq-03-spectrum-08vz)", () => {
  test("the defaults are accepted", () => {
    const result = validateLq03Parameters(LQ03_DEFAULTS);
    expect(result.kind).toBe("accepted");
  });

  test("temperature outside [500, 10000] K is refused with an explanation naming the bound", () => {
    const tooLow = validateLq03Parameters({ ...LQ03_DEFAULTS, T: 100 });
    expect(tooLow.kind).toBe("refused");
    if (tooLow.kind !== "refused") return;
    expect(String(tooLow.refusal.details?.requirements)).toMatch(/500 K and 10000 K/);

    const tooHigh = validateLq03Parameters({ ...LQ03_DEFAULTS, T: 1e6 });
    expect(tooHigh.kind).toBe("refused");
  });

  test("a temperature refused for being too high protects against the known adaptive-quadrature defect (see session.test.ts)", () => {
    // T=1e5 is confirmed (by direct measurement, not assumed) to make
    // planckBandEnergyDensity hang; this bead's own validator must refuse it, not merely
    // happen not to trigger it.
    const refused = validateLq03Parameters({ ...LQ03_DEFAULTS, T: 1e5 });
    expect(refused.kind).toBe("refused");
  });

  test("band edges outside [1e11, 1e16] Hz are refused", () => {
    const tooLow = validateLq03Parameters({ ...LQ03_DEFAULTS, nu1: 1e9, nu2: 2e9 });
    expect(tooLow.kind).toBe("refused");
    const tooHigh = validateLq03Parameters({ ...LQ03_DEFAULTS, nu1: 5e16, nu2: 6e16 });
    expect(tooHigh.kind).toBe("refused");
  });

  test("an inverted band (nu2 <= nu1) is refused with an explanation naming both edges", () => {
    const inverted = validateLq03Parameters({ ...LQ03_DEFAULTS, nu1: 6e14, nu2: 4e14 });
    expect(inverted.kind).toBe("refused");
    if (inverted.kind !== "refused") return;
    expect(String(inverted.refusal.details?.requirements)).toMatch(/inverted or empty/);
  });

  test("an empty band (nu2 === nu1) is refused", () => {
    const empty = validateLq03Parameters({ ...LQ03_DEFAULTS, nu1: 5e14, nu2: 5e14 });
    expect(empty.kind).toBe("refused");
  });

  test("epsilon outside (0, 1) is refused", () => {
    expect(validateLq03Parameters({ ...LQ03_DEFAULTS, epsilon: 0 }).kind).toBe("refused");
    expect(validateLq03Parameters({ ...LQ03_DEFAULTS, epsilon: 1 }).kind).toBe("refused");
    expect(validateLq03Parameters({ ...LQ03_DEFAULTS, epsilon: -0.1 }).kind).toBe("refused");
  });

  test("an unknown coordinate or axisScale is refused rather than silently defaulted", () => {
    expect(validateLq03Parameters({ ...LQ03_DEFAULTS, coordinate: "angular" }).kind).toBe(
      "refused",
    );
    expect(validateLq03Parameters({ ...LQ03_DEFAULTS, axisScale: "exponential" }).kind).toBe(
      "refused",
    );
  });

  test("an incomplete parameter record is refused rather than filled in with defaults", () => {
    const { T } = LQ03_DEFAULTS;
    expect(validateLq03Parameters({ T }).kind).toBe("refused");
  });

  test("an out-of-range temperature is refused, never silently clamped to a boundary value", () => {
    const result = validateLq03Parameters({ ...LQ03_DEFAULTS, T: 99999 });
    // Never { kind: "accepted", data: { T: 10000, ... } } (a silent clamp) --
    // always a refusal that explains, per this bead's acceptance criteria.
    expect(result.kind).toBe("refused");
  });
});
