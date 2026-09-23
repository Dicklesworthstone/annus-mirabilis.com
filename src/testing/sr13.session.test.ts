import { describe, expect, test } from "bun:test";
import { SR13_DEFAULTS, SR13_OUTPUTS } from "../experiments/sr13/definition.ts";
import { validateSr13Parameters } from "../experiments/sr13/parameters.ts";
import { decodeSr13Settings, encodeSr13Settings } from "../experiments/sr13/permalink.ts";
import { createSr13Session, snapshotOutputs } from "../experiments/sr13/session.ts";

describe("SR-13 session store, parameter validation, and permalinks", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr13Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    // Every declared output is published and nothing undeclared is: a property that holds however
    // many outputs the contract names, where "11" broke the day the path was added.
    expect(new Set(snap?.outputs.map((o) => o.quantityId))).toEqual(
      new Set(Object.keys(SR13_OUTPUTS)),
    );
    expect(Object.keys(SR13_OUTPUTS).length).toBeGreaterThan(0);
    expect(session.acceptedParameters().initialSpeed).toBe(0.6);
  });

  test("presentation change (forceConvention) keeps run identity", () => {
    const session = createSr13Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      forceConvention: "laboratory",
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
  });

  test("setup change advances input revision", () => {
    const session = createSr13Session();
    const beforeRev = session.getSnapshot().accepted?.revisions.input ?? 0;
    const applied = session.apply({
      ...session.acceptedParameters(),
      initialSpeed: 0.8,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.revisions.input).toBeGreaterThan(beforeRev);
  });

  test("superluminal parameter is refused", () => {
    const checked = validateSr13Parameters({
      ...SR13_DEFAULTS,
      initialSpeed: 1.05,
    });
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") {
      expect(checked.refusal.code).toBe("invalid-parameter");
    }

    const session = createSr13Session("sr13-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      initialSpeed: 1.05,
    });
    expect(res.kind).toBe("refused");
  });

  test("permalink encode and decode round-trip", () => {
    const params = {
      electricFieldX: 0,
      electricFieldY: 1e5,
      electricFieldZ: 0,
      magneticFieldX: 0,
      magneticFieldY: 0,
      magneticFieldZ: 0.01,
      initialSpeed: 0.75,
      initialDirectionDeg: 30,
      integrationInterval: 1e-9,
      forceConvention: "laboratory" as const,
      massLanguage: "modern" as const,
      particle: "custom" as const,
      customCharge: -1.6e-19,
      customMass: 9.1e-31,
      datasetOverlay: "bucherer-1908" as const,
    };
    const encoded = encodeSr13Settings(params);
    const decoded = decodeSr13Settings(encoded);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.initialSpeed).toBe(0.75);
      expect(decoded.parameters.electricFieldY).toBe(1e5);
      expect(decoded.parameters.magneticFieldZ).toBe(0.01);
      expect(decoded.parameters.forceConvention).toBe("laboratory");
      expect(decoded.parameters.massLanguage).toBe("modern");
      expect(decoded.parameters.datasetOverlay).toBe("bucherer-1908");
    }
  });

  test("snapshot outputs match evaluateSr13", () => {
    const outputs = snapshotOutputs(SR13_DEFAULTS);
    expect(new Set(outputs.map((o) => o.quantityId))).toEqual(new Set(Object.keys(SR13_OUTPUTS)));
    const longM = outputs.find((o) => o.quantityId === "longitudinalMass");
    expect(longM?.status).toBe("value");
  });
});
