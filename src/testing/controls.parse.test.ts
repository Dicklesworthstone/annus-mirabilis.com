import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../content/schemas/experiment.ts";
import { parseParameterValue, serializeParameterValue } from "../experiments/controls/parse.ts";

describe("Parameter Controls Parse & Serialize Round-Trips (am-inst-parameter-controls-cmj9)", () => {
  const viscositySpec: ParameterSpec = {
    id: "eta",
    label: "Viscosity",
    accessibleName: "Viscosity",
    accessibleDescription: "Dynamic viscosity",
    quantityId: "viscosity",
    displayUnit: "Pa*s",
    modelDomain: { min: 0.0001, max: 1.0 },
    visualRange: { min: 0.0005, max: 0.02 },
    default: 0.00135,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const radiusSpec: ParameterSpec = {
    id: "a",
    label: "Radius",
    accessibleName: "Radius",
    accessibleDescription: "Particle radius",
    quantityId: "particleRadius",
    displayUnit: "m",
    modelDomain: { min: 1e-8, max: 1e-5 },
    visualRange: { min: 1e-7, max: 5e-6 },
    default: 5e-7,
    mapping: { kind: "log", base: 10 },
    role: "independent",
    commandClass: "setup-change",
  };

  test("1.35e-3 Pa*s and 5e-7 m round-trip unchanged in canonical SI", () => {
    // Viscosity 1.35e-3 Pa*s
    const parsedVisc = parseParameterValue(viscositySpec, "1.35e-3 Pa*s");
    expect(parsedVisc.ok).toBe(true);
    if (parsedVisc.ok) {
      expect(parsedVisc.canonicalValue).toBe(0.00135);
      const serialized = serializeParameterValue(viscositySpec, parsedVisc.canonicalValue);
      expect(Number(serialized)).toBe(0.00135);
    }

    // Radius 5e-7 m
    const parsedRadius = parseParameterValue(radiusSpec, "5e-7 m");
    expect(parsedRadius.ok).toBe(true);
    if (parsedRadius.ok) {
      expect(parsedRadius.canonicalValue).toBe(5e-7);
      const serialized = serializeParameterValue(radiusSpec, parsedRadius.canonicalValue);
      expect(Number(serialized)).toBe(5e-7);
    }
  });

  test("rejects oversize input and unparseable gibberish", () => {
    const oversize = "9".repeat(10000);
    const parsedOversize = parseParameterValue(viscositySpec, oversize);
    expect(parsedOversize.ok).toBe(false);

    const gibberish = "not-a-number-123xyz";
    const parsedGibberish = parseParameterValue(viscositySpec, gibberish);
    expect(parsedGibberish.ok).toBe(false);
  });
});
