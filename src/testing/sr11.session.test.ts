import { describe, expect, test } from "bun:test";
import { SR11_DEFAULTS } from "../experiments/sr11/definition.ts";
import { validateSr11Parameters } from "../experiments/sr11/parameters.ts";
import { decodeSr11Settings, encodeSr11Settings } from "../experiments/sr11/permalink.ts";
import { createSr11Session, snapshotOutputs } from "../experiments/sr11/session.ts";

describe("SR-11 session store, parameter validation, and permalinks", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr11Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.length).toBe(10);
    expect(session.acceptedParameters().beta).toBe(0.6);
  });

  test("observer change (frame switch) keeps run identity", () => {
    const session = createSr11Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      frame: "mirror",
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
  });

  test("setup change advances input revision", () => {
    const session = createSr11Session();
    const beforeRev = session.getSnapshot().accepted?.revisions.input ?? 0;
    const applied = session.apply({
      ...session.acceptedParameters(),
      beta: -0.6,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.revisions.input).toBeGreaterThan(beforeRev);
  });

  test("superluminal parameter is refused", () => {
    const checked = validateSr11Parameters({
      ...SR11_DEFAULTS,
      beta: 1.05,
    });
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") {
      expect(checked.refusal.code).toBe("invalid-parameter");
    }

    const session = createSr11Session("sr11-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      beta: 1.05,
    });
    expect(res.kind).toBe("refused");
  });

  test("negative angle or angle > 180 is refused", () => {
    const checkedNeg = validateSr11Parameters({
      ...SR11_DEFAULTS,
      incidentAngleDeg: -10,
    });
    expect(checkedNeg.kind).toBe("refused");

    const checkedOver = validateSr11Parameters({
      ...SR11_DEFAULTS,
      incidentAngleDeg: 190,
    });
    expect(checkedOver.kind).toBe("refused");
  });

  test("permalink encode and decode round-trip", () => {
    const params = {
      beta: 0.75,
      incidentAngleDeg: 25,
      incidentEnergyDensity: 2.5,
      mirrorArea: 1.5,
      frame: "mirror" as const,
      unitLayer: "gaussian" as const,
    };
    const encoded = encodeSr11Settings(params);
    const decoded = decodeSr11Settings(encoded);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.beta).toBe(0.75);
      expect(decoded.parameters.incidentAngleDeg).toBe(25);
      expect(decoded.parameters.incidentEnergyDensity).toBe(2.5);
      expect(decoded.parameters.mirrorArea).toBe(1.5);
      expect(decoded.parameters.frame).toBe("mirror");
      expect(decoded.parameters.unitLayer).toBe("gaussian");
    }
  });

  test("snapshot outputs match evaluateSr11", () => {
    const outputs = snapshotOutputs(SR11_DEFAULTS);
    expect(outputs.length).toBe(10);
    const freqRatio = outputs.find((o) => o.quantityId === "frequencyRatio");
    expect(freqRatio?.status).toBe("value");
    if (freqRatio?.status === "value" && typeof freqRatio.value === "number") {
      expect(freqRatio.value).toBeCloseTo(0.25, 10);
    }
  });
});
