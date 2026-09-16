import { describe, expect, test } from "bun:test";
import {
  emptyHamiltonianReport,
  measureSteadyPowerBalance,
  validateDiscretePassivityAndConservation,
  verifyTimestepConvergence,
} from "../physics/energyLedger.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Energy Ledger and Conservation Verification", () => {
  test("steady power balance calculates signed residual and reports balanced status", () => {
    const start = performance.now();
    const balanced = measureSteadyPowerBalance(100, 100);
    expect(balanced.kind).toBe("steady-state");
    if (balanced.kind === "steady-state") {
      expect(balanced.balanced).toBe(true);
      expect(balanced.residualWatts).toBe(0);
    }

    const unbalanced = measureSteadyPowerBalance(100, 95);
    expect(unbalanced.kind).toBe("steady-state");
    if (unbalanced.kind === "steady-state") {
      expect(unbalanced.balanced).toBe(false);
      expect(unbalanced.residualWatts).toBe(5);
    }

    const invalid = measureSteadyPowerBalance(-10, 100);
    expect(invalid.kind).toBe("unavailable");

    appendExtractionLog({
      logRunId,
      testId: "energy-ledger-steady-power-balance",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "measureSteadyPowerBalance computes signed power residuals and tolerances",
    });
  });

  test("validateDiscretePassivityAndConservation validates power balance and catches unit errors", () => {
    const start = performance.now();
    const valid = validateDiscretePassivityAndConservation({
      powerInWatts: 50,
      powerOutWatts: 30,
      powerDissipatedWatts: 20,
      dHdtWatts: 0,
      powerInUnit: "W",
      powerOutUnit: "W",
      powerDissipatedUnit: "W",
    });
    expect(valid.passed).toBe(true);
    expect(valid.passivityViolated).toBe(false);

    // Unit mismatch on input port
    const badUnit = validateDiscretePassivityAndConservation({
      powerInWatts: 50,
      powerDissipatedWatts: 50,
      powerInUnit: "J", // Energy instead of Power
    });
    expect(badUnit.passed).toBe(false);
    expect(badUnit.refusalReason).toContain("Unit mismatch");

    appendExtractionLog({
      logRunId,
      testId: "energy-ledger-discrete-passivity-units",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "validateDiscretePassivityAndConservation checks power balance and enforces Watt unit dimension",
    });
  });

  test("validateDiscretePassivityAndConservation catches unphysical energy injection (negative dissipation)", () => {
    const start = performance.now();
    const injected = validateDiscretePassivityAndConservation({
      powerInWatts: 10,
      powerOutWatts: 20,
      powerDissipatedWatts: -10, // Negative dissipation -> active energy injection
    });
    expect(injected.passed).toBe(false);
    expect(injected.passivityViolated).toBe(true);
    expect(injected.refusalReason).toContain("UNPHYSICAL_ENERGY_INJECTION");

    appendExtractionLog({
      logRunId,
      testId: "energy-ledger-passivity-violation-negative-dissipation",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Catches unphysical energy injection when dissipation is negative",
    });
  });

  test("verifyTimestepConvergence verifies monotonic error reduction and estimates convergence order", () => {
    const start = performance.now();
    // First-order Euler stepper for dy/dt = -y, y(0)=1 => exact y(t)=exp(-t)
    // Step forward T=0.1 with step dt
    function runEuler(dt: number): { y: number } {
      let y = 1.0;
      const steps = Math.round(0.1 / dt);
      for (let i = 0; i < steps; i++) {
        y += dt * -y;
      }
      return { y };
    }

    const report = verifyTimestepConvergence(runEuler, (res) => res.y, 0.04);
    expect(report.monotonic).toBe(true);
    expect(report.converged).toBe(true);
    expect(report.estimatedOrder).toBeGreaterThan(0.5); // Near order 1.0

    appendExtractionLog({
      logRunId,
      testId: "energy-ledger-timestep-convergence",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "verifyTimestepConvergence confirms monotonic convergence across nested timesteps",
    });
  });

  test("emptyHamiltonianReport provides safe fallback representation", () => {
    const start = performance.now();
    const report = emptyHamiltonianReport("No energy model registered");
    expect(report.availability).toBe("unavailable");
    expect(report.storedEnergyAvailable).toBe(false);
    expect(report.inputPowerAvailable).toBe(false);

    appendExtractionLog({
      logRunId,
      testId: "energy-ledger-empty-report",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "emptyHamiltonianReport returns safe default report with unavailable reason",
    });
  });
});
