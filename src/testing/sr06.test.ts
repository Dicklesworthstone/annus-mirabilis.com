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
  test("the collinear and angled modes still compose the moving point", () => {
    expect(read({ mode: "collinear" }, "composedSpeedOverC")).toBeCloseTo(15 / 17, 12);
    expect(read({ mode: "angled", alphaDeg: 90 }, "composedSpeedOverC")).toBeCloseTo(0.768375, 6);
  });
});
