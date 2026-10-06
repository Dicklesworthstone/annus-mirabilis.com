import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SR06_DEFAULTS } from "../experiments/sr06/definition.ts";
import { validateSr06Parameters } from "../experiments/sr06/parameters.ts";
import { createSr06Session, evaluateSr06 } from "../experiments/sr06/session.ts";
import { alignedBoost, composeBoosts, generalBoost } from "../physics/reference/kinematics.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const suite = "instrument-sr-06";
const logRoot = mkdtempSync(join(tmpdir(), "sr06-"));
const logger = new TestLogger(suite, newRunIdentity(), logRoot);

function scalar(id: string, outputs: ReturnType<typeof evaluateSr06>): number {
  const o = outputs.find((r) => r.quantityId === id);
  expect(o?.status).toBe("value");
  if (o?.status !== "value" || typeof o.value !== "number") throw new Error(id);
  return o.value;
}

describe("sr-06 composition against kinematics.ts (am-sr-06-velocity-composition-7ni4)", () => {
  test("collinear 0.6 ⊕ 0.6 is 15/17 c", () => {
    const out = evaluateSr06(SR06_DEFAULTS);
    expect(scalar("composedSpeedOverC", out)).toBeCloseTo(15 / 17, 12);
    expect(scalar("galileanSpeedOverC", out)).toBeCloseTo(1.2, 12);
    logger.log({
      testId: "collinear-0.6",
      beadId: "am-sr-06-velocity-composition-7ni4",
      instrumentId: "sr-06",
      outcome: "passed",
      message: "15/17",
    });
  });

  test("printed 90 degree formula at 0.6c is 0.768375 c", () => {
    const out = evaluateSr06({ ...SR06_DEFAULTS, alphaDeg: 90, mode: "angled" });
    expect(scalar("printedSpeedOverC", out)).toBeCloseTo(0.768375, 6);
    expect(scalar("composedSpeedOverC", out)).toBeCloseTo(0.768375, 6);
  });

  test("perpendicular boosts 0.6c: gamma 1.5625, speed 0.768375c, rotation 12.6804 deg", () => {
    const out = evaluateSr06({
      ...SR06_DEFAULTS,
      mode: "two-boosts",
      secondBeta: 0.6,
      secondAngleDeg: 90,
    });
    expect(scalar("composedGamma", out)).toBeCloseTo(1.5625, 12);
    expect(Math.abs(scalar("rotationDeg", out))).toBeCloseTo(12.6804, 3);
    const matrix = out.find((r) => r.quantityId === "productMatrix");
    expect(matrix?.status).toBe("value");
    const first = alignedBoost(0.6, 1);
    const second = generalBoost({ bx: 0, by: 0.6, bz: 0 }, 1);
    expect(first.status).toBe("value");
    expect(second.status).toBe("value");
    if (first.status !== "value" || second.status !== "value") return;
    const composed = composeBoosts(first.value, second.value);
    expect(composed.status).toBe("value");
    if (composed.status !== "value" || matrix?.status !== "value") return;
    const parallel = generalBoost(composed.value.boost.beta, 1);
    expect(parallel.status).toBe("value");
    if (parallel.status !== "value") return;
    let diff = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        diff += ((composed.value.product[i]?.[j] ?? 0) - (parallel.value.matrix[i]?.[j] ?? 0)) ** 2;
      }
    }
    expect(diff).toBeGreaterThan(1e-8);
  });

  test("0.99 ⊕ 0.99 shortfall is 1/19801", () => {
    const out = evaluateSr06({ ...SR06_DEFAULTS, frameBeta: 0.99, movingSpeed: 0.99 });
    expect(scalar("shortfall", out)).toBeCloseTo(1 / 19801, 12);
    expect(scalar("composedSpeedOverC", out)).toBeCloseTo(0.9999495, 7);
  });

  test("transverse light ray stays at c; inverse round-trip recovers the moving-frame components", () => {
    const out = evaluateSr06({ ...SR06_DEFAULTS, movingSpeed: 1, alphaDeg: 90, mode: "angled" });
    expect(scalar("composedSpeedOverC", out)).toBeCloseTo(1, 12);
    const collinear = evaluateSr06(SR06_DEFAULTS);
    expect(scalar("inverseUxOverC", collinear)).toBeCloseTo(0.6, 12);
    expect(scalar("inverseUyOverC", collinear)).toBeCloseTo(0, 12);
  });

  test("|v| >= c is a typed refusal, not a clamp", () => {
    const r = validateSr06Parameters({ ...SR06_DEFAULTS, frameBeta: 1 });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.refusal.code).toBe("superluminal-observer");
    const session = createSr06Session("sr06-refuse");
    const applied = session.apply({ ...SR06_DEFAULTS, frameBeta: 1 });
    expect(applied.kind).toBe("refused");
    expect(session.acceptedParameters().frameBeta).toBe(0.6);
  });

  test("Fizeau increment 3.08676358 m/s", () => {
    const out = evaluateSr06(SR06_DEFAULTS);
    expect(scalar("fizeauIncrement", out) / 3.08676358).toBeCloseTo(1, 8);
  });
});

describe("SR-06 two-boosts mode reports the doubly boosted frame's velocity", () => {
  const read = (p: Partial<typeof SR06_DEFAULTS>, id: string) => {
    const o = evaluateSr06({ ...SR06_DEFAULTS, ...p }).find((r) => r.quantityId === id);
    return o?.status === "value" && typeof o.value === "number" ? o.value : Number.NaN;
  };
  test("0.6c then 0.6c at right angles: speed 0.768375c, consistent with gamma 1.5625", () => {
    // Before the fix the table showed the moving point's collinear 0.882c here, beside the product's
    // gamma 1.5625, which belongs to 0.768c. The bead's fixture is 0.768375c.
    const p = { mode: "two-boosts" as const, frameBeta: 0.6, secondBeta: 0.6, secondAngleDeg: 90 };
    const U = read(p, "composedSpeedOverC");
    expect(U).toBeCloseTo(0.768375, 6);
    expect(read(p, "composedUxOverC")).toBeCloseTo(0.6, 12);
    expect(read(p, "composedUyOverC")).toBeCloseTo(0.48, 12);
    expect(1 / Math.sqrt(1 - U * U)).toBeCloseTo(read(p, "composedGamma"), 10);
  });
  test("the Lorentz factor belongs to the composed speed, IN EVERY MODE", () => {
    // THIS IS THE ASSERTION THAT WAS MISSING, and its absence is why a defect survived in plain sight.
    // The consistency of gamma with U was checked for two-boosts mode only, three tests above. In the
    // angled branch composedGamma was computed from the COLLINEAR composition of the two speeds whatever
    // the angle, so at 90 degrees the table read U = 0.768c beside gamma = 2.125 - and 2.125 is the
    // factor of 0.882c. Same defect as the one the session's own comment records as fixed in two-boosts
    // mode, surviving in the branch nobody asserted.
    //
    // Checked across modes AND angles rather than at one setting, because the bug was invisible at
    // alpha = 0 (where the collinear composition IS the composed speed) and that is exactly where a
    // single-point test would have been written.
    for (const p of [
      { mode: "collinear" as const, frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 0 },
      { mode: "angled" as const, frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 90 },
      { mode: "angled" as const, frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 45 },
      { mode: "angled" as const, frameBeta: 0.8, movingSpeed: 0.5, alphaDeg: 60 },
      { mode: "two-boosts" as const, frameBeta: 0.6, secondBeta: 0.6, secondAngleDeg: 90 },
    ]) {
      const U = read(p, "composedSpeedOverC");
      const gamma = read(p, "composedGamma");
      expect(Number.isFinite(U)).toBe(true);
      expect(Number.isFinite(gamma)).toBe(true);
      expect(gamma).toBeCloseTo(1 / Math.sqrt(1 - U * U), 10);
    }
  });

  test("the angled factor is 1.5625 and not the collinear 2.125, named rather than only derived", () => {
    // The identity above would also pass if both quantities were wrong together. This names the two
    // numbers, so a regression that recomputed BOTH from the collinear composition could not hide in it.
    const p = { mode: "angled" as const, frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 90 };
    expect(read(p, "composedSpeedOverC")).toBeCloseTo(0.7683749084919418, 12);
    expect(read(p, "composedGamma")).toBeCloseTo(1.5625, 12);
    expect(read({ ...p, mode: "collinear" as const, alphaDeg: 0 }, "composedGamma")).toBeCloseTo(
      2.125,
      12,
    );
  });

  test("the collinear and angled modes still compose the moving point", () => {
    expect(read({ mode: "collinear" }, "composedSpeedOverC")).toBeCloseTo(15 / 17, 12);
    expect(read({ mode: "angled", alphaDeg: 90 }, "composedSpeedOverC")).toBeCloseTo(0.768375, 6);
  });
});
