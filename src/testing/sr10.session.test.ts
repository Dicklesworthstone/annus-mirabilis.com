import { describe, expect, test } from "bun:test";
import { SR10_DEFAULTS } from "../experiments/sr10/definition.ts";
import { validateSr10Parameters } from "../experiments/sr10/parameters.ts";
import { createSr10Session, snapshotOutputs } from "../experiments/sr10/session.ts";

describe("SR-10 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr10Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.length).toBe(18);
    expect(session.acceptedParameters().beta).toBe(0.6);
  });

  test("observer change updates speed and maintains store integrity", () => {
    const session = createSr10Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      beta: 0.8,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
    expect(session.acceptedParameters().beta).toBe(0.8);
  });

  test("setup change updates propagation angle and initial energy", () => {
    const session = createSr10Session();
    const applied = session.apply({
      ...session.acceptedParameters(),
      propagationAngleDeg: 180,
      initialEnergyJ: 5.0,
      initialVolumeM3: 2.0,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.acceptedParameters().propagationAngleDeg).toBe(180);
    expect(session.acceptedParameters().initialEnergyJ).toBe(5.0);
    expect(session.acceptedParameters().initialVolumeM3).toBe(2.0);
  });

  test("superluminal speed and invalid parameters are refused", () => {
    const checkedBeta = validateSr10Parameters({
      ...SR10_DEFAULTS,
      beta: 1.05,
    });
    expect(checkedBeta.kind).toBe("refused");
    if (checkedBeta.kind === "refused") {
      expect(checkedBeta.refusal.code).toBe("superluminal-observer");
    }

    const checkedEnergy = validateSr10Parameters({
      ...SR10_DEFAULTS,
      initialEnergyJ: -1.0,
    });
    expect(checkedEnergy.kind).toBe("refused");

    const checkedVolume = validateSr10Parameters({
      ...SR10_DEFAULTS,
      initialVolumeM3: 0,
    });
    expect(checkedVolume.kind).toBe("refused");

    const session = createSr10Session("sr10-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      beta: 1.2,
    });
    expect(res.kind).toBe("refused");
  });

  test("snapshot outputs match evaluateSr10", () => {
    const outputs = snapshotOutputs(SR10_DEFAULTS);
    expect(outputs.length).toBe(18);
    const doppler = outputs.find((o) => o.quantityId === "dopplerFactor");
    expect(doppler?.status).toBe("value");
    if (doppler?.status === "value") {
      expect(doppler.value).toBeCloseTo(0.5, 12);
    }
    const energyMoving = outputs.find((o) => o.quantityId === "lightComplexEnergyMoving");
    expect(energyMoving?.status).toBe("value");
    if (energyMoving?.status === "value") {
      expect(energyMoving.value).toBeCloseTo(0.5, 12);
    }
    const volumeMoving = outputs.find((o) => o.quantityId === "lightComplexVolumeMoving");
    expect(volumeMoving?.status).toBe("value");
    if (volumeMoving?.status === "value") {
      expect(volumeMoving.value).toBeCloseTo(2.0, 12);
    }
  });
});
