import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SR07_CAPTION, SR07_DEFAULTS, SR07_EQUATIONS } from "../experiments/sr07/definition.ts";
import { validateSr07Parameters } from "../experiments/sr07/parameters.ts";
import { decodeSr07Settings, encodeSr07Settings } from "../experiments/sr07/permalink.ts";
import { createSr07Session, evaluateSr07 } from "../experiments/sr07/session.ts";
import { maxwellResidualsPlaneWave, SR07_EVENT_SEED } from "../physics/reference/fields.ts";
import { gamma } from "../physics/reference/kinematics.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const logRoot = mkdtempSync(join(tmpdir(), "sr07-"));
const logger = new TestLogger("instrument-sr-07", newRunIdentity(), logRoot);

function scalar(id: string, outputs: ReturnType<typeof evaluateSr07>): number {
  const o = outputs.find((r) => r.quantityId === id);
  expect(o?.status).toBe("value");
  if (o?.status !== "value" || typeof o.value !== "number") throw new Error(id);
  return o.value;
}

describe("sr-07 field-equation residuals (am-sr-07-field-equations-xxes)", () => {
  test("default +x wave at 0.6c has amplitude and frequency factors 0.5 and passes form invariance", () => {
    const g = gamma(0.6);
    expect(g.status).toBe("value");
    if (g.status === "value") expect(g.value * (1 - 0.6)).toBeCloseTo(0.5, 12);
    const out = evaluateSr07(SR07_DEFAULTS);
    expect(scalar("amplitudeFactor", out)).toBeCloseTo(0.5, 12);
    expect(scalar("frequencyFactor", out)).toBeCloseTo(0.5, 12);
    expect(scalar("formInvariant", out)).toBe(1);
    expect(scalar("lorentzFactor", out)).toBeCloseTo(1.25, 12);
    logger.log({
      testId: "plane-wave-0.6",
      beadId: "am-sr-07-field-equations-xxes",
      paper: "special-relativity",
      anchor: "s6",
      instrumentId: "sr-07",
      outcome: "passed",
      comparisonKind: "tolerance",
      expected: 0.5,
      actual: scalar("amplitudeFactor", out),
      tolerance: { relative: 1e-12 },
      executionLabel: "Ideal model, host calculation",
      message: "amplitude and frequency factors 0.5",
      extra: {
        equationId: SR07_DEFAULTS.equationId,
        step: SR07_DEFAULTS.stepIndex,
        unitLayer: SR07_DEFAULTS.unitLayer,
        wave: SR07_DEFAULTS.wave,
        beta: 0.6,
        residualMax: scalar("residualMax", out),
        eventSeed: SR07_EVENT_SEED,
        badge: "form-invariant",
      },
    });
  });

  test("printed transform keeps residuals small on admitted waves and betas", () => {
    const waves = ["plus-x", "minus-x", "plus-y", "oblique"] as const;
    const betas = [-0.95, -0.6, 0, 0.6, 0.95];
    for (const wave of waves) {
      for (const polarization of ["primary", "secondary"] as const) {
        for (const beta of betas) {
          const report = maxwellResidualsPlaneWave({ beta, wave, polarization });
          expect(report.passed).toBe(true);
          expect(report.eventSeed).toBe(SR07_EVENT_SEED);
          expect(report.residuals.length).toBe(6);
        }
      }
    }
  });

  test("flipping Z' = β(Z + v/V M) breaks Faraday and Ampere form", () => {
    const good = maxwellResidualsPlaneWave({
      beta: 0.6,
      wave: "plus-x",
      polarization: "secondary",
    });
    const bad = maxwellResidualsPlaneWave({
      beta: 0.6,
      wave: "plus-x",
      polarization: "secondary",
      convention: "flipped-z-prime",
    });
    expect(good.passed).toBe(true);
    expect(bad.passed).toBe(false);
    expect(bad.maxResidual).toBeGreaterThan(good.maxResidual * 1e6 + 1e-8);
    const broken: number[] = [];
    for (let i = 0; i < 6; i++) {
      const g = good.residuals[i] ?? 0;
      const b = bad.residuals[i] ?? 0;
      if (b > g * 1e6 + 1e-8) broken.push(i);
    }
    expect(broken.length).toBeGreaterThanOrEqual(2);
    expect(broken.some((i) => i < 3)).toBe(true);
    expect(broken.some((i) => i >= 3)).toBe(true);
    logger.log({
      testId: "flipped-z-prime",
      beadId: "am-sr-07-field-equations-xxes",
      instrumentId: "sr-07",
      outcome: "passed",
      message: "planted Z-prime sign flip breaks Faraday and Ampere residuals",
      extra: {
        wave: "plus-x",
        polarization: "secondary",
        beta: 0.6,
        residualMax: bad.maxResidual,
        eventSeed: SR07_EVENT_SEED,
        badge: "form-broken",
        brokenEquations: broken,
      },
    });
  });

  test("|v| >= c is a typed refusal", () => {
    const r = validateSr07Parameters({ ...SR07_DEFAULTS, boostBeta: 1 });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.refusal.code).toBe("superluminal-observer");
    const session = createSr07Session("sr07-refuse");
    expect(session.apply({ ...SR07_DEFAULTS, boostBeta: 1 }).kind).toBe("refused");
    expect(session.acceptedParameters().boostBeta).toBe(0.6);
  });

  test("permalink round-trips equation, step, units, wave, and polarization", () => {
    const encoded = encodeSr07Settings({
      ...SR07_DEFAULTS,
      equationId: "faraday-z",
      stepIndex: 3,
      unitLayer: "modern-si",
      wave: "oblique",
      polarization: "secondary",
    });
    const decoded = decodeSr07Settings(encoded);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind !== "settings") return;
    expect(decoded.parameters.equationId).toBe("faraday-z");
    expect(decoded.parameters.stepIndex).toBe(3);
    expect(decoded.parameters.unitLayer).toBe("modern-si");
    expect(decoded.parameters.wave).toBe("oblique");
    expect(decoded.parameters.polarization).toBe("secondary");
  });

  test("printed and SI forms are labeled; L and N are magnetic in this paper", () => {
    expect(SR07_EQUATIONS["ampere-x"].printed).toContain("N");
    expect(SR07_EQUATIONS["ampere-x"].si).toContain("B_z");
    expect(SR07_EQUATIONS["faraday-x"].spoken.toLowerCase()).toContain("magnetic");
    expect(SR07_EQUATIONS["faraday-z"].spoken.toLowerCase()).toContain("avogadro");
    expect(SR07_CAPTION.r1).toMatch(/L, M, N are magnetic/);
    expect(SR07_CAPTION.r2).toContain("Gaussian");
    expect(SR07_CAPTION.r2).toContain("SI");
    expect(SR07_CAPTION.r3).toMatch(/L and N here are magnetic/i);
  });
});
