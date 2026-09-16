import { describe, expect, test } from "bun:test";
import { SR09_DEFAULTS } from "../experiments/sr09/definition.ts";
import { validateSr09Parameters } from "../experiments/sr09/parameters.ts";
import { createSr09Session, snapshotOutputs } from "../experiments/sr09/session.ts";

describe("SR-09 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr09Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.length).toBe(12);
    expect(session.acceptedParameters().beta).toBe(0.6);
  });

  test("observer change updates state and maintains store integrity", () => {
    const session = createSr09Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      beta: 0.8,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
    expect(session.acceptedParameters().beta).toBe(0.8);
  });

  test("setup change updates propagation angle and frequency", () => {
    const session = createSr09Session();
    const applied = session.apply({
      ...session.acceptedParameters(),
      propagationAngleDeg: 180,
      frequencyTHz: 600,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.acceptedParameters().propagationAngleDeg).toBe(180);
    expect(session.acceptedParameters().frequencyTHz).toBe(600);
  });

  test("superluminal speed is refused", () => {
    const checked = validateSr09Parameters({
      ...SR09_DEFAULTS,
      beta: 1.05,
    });
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") {
      expect(checked.refusal.code).toBe("invalid-parameter");
    }

    const session = createSr09Session("sr09-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      beta: 1.2,
    });
    expect(res.kind).toBe("refused");
  });

  test("snapshot outputs match evaluateSr09", () => {
    const outputs = snapshotOutputs(SR09_DEFAULTS);
    expect(outputs.length).toBe(12);
    const doppler = outputs.find((o) => o.quantityId === "dopplerFactor");
    expect(doppler?.status).toBe("value");
    if (doppler?.status === "value") {
      expect(doppler.value).toBeCloseTo(0.5, 12);
    }
  });
});
