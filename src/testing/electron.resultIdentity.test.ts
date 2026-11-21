import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { SR13_DEFAULTS } from "../experiments/sr13/definition.ts";
import { createSr13Session } from "../experiments/sr13/session.ts";
import {
  acceleratingPotential,
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  kineticEnergy,
} from "../physics/reference/electron.ts";

describe("electron result identities survive unavailable calculations", () => {
  test("each energy approximation retains its own identity when its input is refused", () => {
    for (const [mass, speed] of [
      [0, 0.6],
      [-ELECTRON_MASS, 0.6],
      [Number.NaN, 0.6],
      [ELECTRON_MASS, Number.NaN],
      [ELECTRON_MASS, 1],
      [ELECTRON_MASS, -1.2],
    ] as const) {
      const result = kineticEnergy(mass, speed);
      for (const [entry, quantityId] of [
        [result.exact, "kineticEnergy"],
        [result.newtonian, "kineticEnergyNewtonian"],
        [result.lowSpeedExpansion, "kineticEnergyLowSpeedExpansion"],
      ] as const) {
        expect(entry.quantityId).toBe(quantityId);
        expect(entry.status).toBe("outside-domain");
        expect(entry).not.toHaveProperty("value");
        expect(Object.isFrozen(entry)).toBe(true);
      }
    }
  });

  test("both voltage estimates retain their identity for zero charge and invalid energy", () => {
    for (const [speed, charge, mass] of [
      [0.6, 0, ELECTRON_MASS],
      [0.6, -ELEMENTARY_CHARGE, ELECTRON_MASS],
      [0.6, Number.NaN, ELECTRON_MASS],
      [0.6, Number.POSITIVE_INFINITY, ELECTRON_MASS],
      [0.6, ELEMENTARY_CHARGE, 0],
      [1, ELEMENTARY_CHARGE, ELECTRON_MASS],
    ] as const) {
      const result = acceleratingPotential(speed, charge, mass);
      expect(result.exact.quantityId).toBe("acceleratingPotential");
      expect(result.newtonian.quantityId).toBe("acceleratingPotentialNewtonian");
      expect(result.exact.status).toBe("outside-domain");
      expect(result.newtonian.status).toBe("outside-domain");
      expect(result.newtonian).not.toHaveProperty("value");
      expect(Object.isFrozen(result.newtonian)).toBe(true);
    }
  });

  test("a neutral material point publishes straight motion alongside unavailable electric acceleration", () => {
    const session = createSr13Session("neutral-particle-identities");
    const charged = session.getSnapshot().accepted;
    assert.ok(charged);
    const outcome = session.apply({ ...SR13_DEFAULTS, particle: "custom", customCharge: 0 });
    expect(outcome.kind).toBe("accepted");
    const accepted = session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.runId).not.toBe(charged.runId);
    const outputs = new Map(accepted.outputs.map((entry) => [entry.quantityId, entry]));
    expect(outputs.size).toBe(accepted.outputs.length);
    for (const id of ["acceleratingPotential", "acceleratingPotentialNewtonian"]) {
      const result = outputs.get(id);
      assert.ok(result);
      expect(result.status).toBe("outside-domain");
      if (result.status === "outside-domain") expect(result.reason).toContain("positive charge");
    }
    expect(outputs.get("kineticEnergy")?.status).toBe("value");
    const trajectory = outputs.get("trajectoryPositions");
    assert.ok(trajectory?.status === "value" && typeof trajectory.value !== "number");
    const points = trajectory.value;
    expect(points.length).toBeGreaterThan(2);
    expect(points.at(points.length - 2)).toBeCloseTo(
      SR13_DEFAULTS.initialSpeed * C_SI * SR13_DEFAULTS.integrationInterval,
      12,
    );
    for (let index = 1; index < points.length; index += 2) expect(points.at(index)).toBe(0);

    expect(session.apply(SR13_DEFAULTS).kind).toBe("accepted");
    expect(
      session
        .getSnapshot()
        .accepted?.outputs.find((entry) => entry.quantityId === "acceleratingPotentialNewtonian")
        ?.status,
    ).toBe("value");
  });
});
