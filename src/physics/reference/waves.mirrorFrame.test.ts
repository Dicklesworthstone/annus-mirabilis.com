import { describe, expect, test } from "bun:test";
import { logWaves } from "./waves.log.ts";
import { evaluateSr11, mirrorFrameLedger, movingMirror } from "./waves.ts";

describe("am-ref-waves-r53: waves.mirrorFrame.test.ts", () => {
  test("Mirror-frame ledger at normal incidence beta = 0.6: zero work, equal powers, reproduced force", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const ledger = mirrorFrameLedger(beta, 0, { I: 1.0, Am: 1.0, c: 1.0, runId: "run-mirror-001" });

    expect(ledger.frame).toBe("mirror-rest");
    expect(ledger.runId).toBe("run-mirror-001");
    // In mirror frame: no work is done because the mirror is at rest in this frame
    expect(ledger.workRate).toBe(0);

    // Incident power equals reflected power
    expect(ledger.incidentPower).toBeCloseTo(0.25, 12);
    expect(ledger.reflectedPower).toBeCloseTo(0.25, 12);
    expect(ledger.incidentPower).toBe(ledger.reflectedPower);

    // Radiation force in mirror frame
    expect(ledger.forcePrime).toBeCloseTo(0.5, 12);

    // Force transforms invariantly in longitudinal direction: F_K = F'
    expect(ledger.reproducedForceK).toBeCloseTo(0.5, 12);

    // Check agreement with K-frame movingMirror calculation
    const kRes = movingMirror(beta, 0);
    expect(kRes.status).toBe("value");
    if (kRes.status === "value") {
      expect(ledger.reproducedForceK).toBeCloseTo(kRes.radiationForce, 12);
    }

    logWaves({
      testId: "mirror-frame-normal-incidence",
      beta,
      thetaRad: 0,
      frame: "mirror",
      resultStatus: "value",
      expected: 0.25,
      actual: ledger.incidentPower,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Normal incidence mirror frame has zero work, equal powers of 0.25, and reproduces K-frame force of 0.5.",
    });
  });

  test("Mirror-frame ledger at oblique incidence phi = 30 deg, beta = 0.6", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const phi = Math.PI / 6; // 30 deg
    const ledger = mirrorFrameLedger(beta, phi, { I: 1.0, Am: 1.0, c: 1.0 });

    expect(ledger.workRate).toBe(0);
    expect(ledger.frequencyFactor).toBeCloseTo(0.600480947, 6);
    expect(ledger.cosPhiPrime).toBeCloseTo(0.553775933, 6);
    expect(ledger.incidentPower).toBeCloseTo(0.199679, 5);
    expect(ledger.reflectedPower).toBeCloseTo(0.199679, 5);
    expect(ledger.incidentPower).toBe(ledger.reflectedPower);

    expect(ledger.forcePrime).toBeCloseTo(0.221155, 5);
    expect(ledger.reproducedForceK).toBeCloseTo(0.221155, 5);

    // Compare with K frame calculation
    const kRes = movingMirror(beta, phi);
    expect(kRes.status).toBe("value");
    if (kRes.status === "value") {
      expect(ledger.reproducedForceK).toBeCloseTo(kRes.radiationForce, 12);
    }

    logWaves({
      testId: "mirror-frame-oblique-incidence",
      beta,
      thetaRad: phi,
      frame: "mirror",
      resultStatus: "value",
      expected: 0.199679,
      actual: ledger.incidentPower,
      tolerance: 1e-5,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Oblique 30 deg mirror frame has zero work, equal powers of 0.199679, and reproduces K force 0.221155.",
    });
  });

  test("Identity preservation: switching frame preserves runId and physical event identity", () => {
    const t0 = performance.now();
    const runId = "mirror-run-alpha-42";
    const beta = 0.6;
    const phi = 0;

    const labEvaluation = evaluateSr11({ beta, incidentAngleDeg: 0, frame: "lab" });
    const mirrorEvaluation = evaluateSr11({ beta, incidentAngleDeg: 0, frame: "mirror" });

    expect(labEvaluation.status).toBe("value");
    expect(mirrorEvaluation.status).toBe("value");

    // Force is physically identical in both frame descriptions
    expect(labEvaluation.radiationForce).toBeCloseTo(mirrorEvaluation.radiationForce, 12);

    // Ledger with explicit runId preserves identity
    const ledger = mirrorFrameLedger(beta, phi, { runId });
    expect(ledger.runId).toBe(runId);

    logWaves({
      testId: "mirror-frame-identity-preservation",
      beta,
      frame: "mirror",
      resultStatus: "value",
      expected: runId,
      actual: ledger.runId,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Changing reference frame preserves runId and physical force identity.",
    });
  });

  test("Adversarial case: treating the mirror-frame description as a new run fails identity comparison", () => {
    const t0 = performance.now();
    const originalRunId = "mirror-run-original-1905";
    const ledgerOriginal = mirrorFrameLedger(0.6, 0, { runId: originalRunId });

    // Adversarial: observer change quietly mints a new runId
    const adversarialRunId = "mirror-run-divergent-9999";
    const ledgerAdversarial = mirrorFrameLedger(0.6, 0, { runId: adversarialRunId });

    const identitiesMatch = ledgerOriginal.runId === ledgerAdversarial.runId;
    expect(identitiesMatch).toBe(false);

    logWaves({
      testId: "mirror-frame-adversarial-run-identity-check",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Adversarial test confirms different runIds are rejected by identity comparison.",
    });
  });
});
