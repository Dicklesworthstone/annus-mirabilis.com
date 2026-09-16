import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../content/schemas/experiment.ts";
import { parseParameterValue } from "../experiments/controls/parse.ts";

describe("Parameter Controls Unit Display Adapters & Parsing (am-inst-parameter-controls-cmj9)", () => {
  const viscositySpec: ParameterSpec = {
    id: "eta",
    label: "Viscosity",
    accessibleName: "Viscosity",
    accessibleDescription: "Dynamic viscosity",
    quantityId: "viscosity",
    displayUnit: "mPa s",
    modelDomain: {
      min: 0.0001,
      max: 0.05,
      minInclusive: true,
      maxInclusive: true,
    },
    visualRange: { min: 0.0005, max: 0.02 },
    default: 0.00135,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const radiusSpec: ParameterSpec = {
    id: "a",
    label: "Radius",
    accessibleName: "Particle radius",
    accessibleDescription: "Particle radius",
    quantityId: "particleRadius",
    displayUnit: "um",
    modelDomain: {
      min: 1e-8,
      max: 1e-5,
      minInclusive: true,
      maxInclusive: true,
    },
    visualRange: { min: 1e-7, max: 5e-6 },
    default: 5e-7,
    mapping: { kind: "log", base: 10 },
    role: "independent",
    commandClass: "setup-change",
  };

  test("typed mPa·s, mPa s, and Pa·s entries give identical canonical values", () => {
    // 1. Typed in display units (mPa s): "1.35"
    const parsedDisp = parseParameterValue(viscositySpec, "1.35");
    expect(parsedDisp.ok).toBe(true);
    if (parsedDisp.ok) {
      expect(parsedDisp.canonicalValue).toBeCloseTo(0.00135, 10);
    }

    // 2. Typed explicitly with "1.35 mPa·s"
    const parsedMpaDot = parseParameterValue(viscositySpec, "1.35 mPa·s");
    expect(parsedMpaDot.ok).toBe(true);
    if (parsedMpaDot.ok) {
      expect(parsedMpaDot.canonicalValue).toBeCloseTo(0.00135, 10);
    }

    // 3. Typed explicitly with "1.35 mPa s"
    const parsedMpaSpace = parseParameterValue(viscositySpec, "1.35 mPa s");
    expect(parsedMpaSpace.ok).toBe(true);
    if (parsedMpaSpace.ok) {
      expect(parsedMpaSpace.canonicalValue).toBeCloseTo(0.00135, 10);
    }

    // 4. Typed in canonical base unit "0.00135 Pa*s"
    const parsedPas = parseParameterValue(viscositySpec, "0.00135 Pa*s");
    expect(parsedPas.ok).toBe(true);
    if (parsedPas.ok) {
      expect(parsedPas.canonicalValue).toBeCloseTo(0.00135, 10);
    }

    // 5. Typed in scientific notation "1.35e-3 Pa*s"
    const parsedPasExp = parseParameterValue(viscositySpec, "1.35e-3 Pa*s");
    expect(parsedPasExp.ok).toBe(true);
    if (parsedPasExp.ok) {
      expect(parsedPasExp.canonicalValue).toBeCloseTo(0.00135, 10);
    }
  });

  test("length entries with nm, um, and m give identical canonical values", () => {
    const fromUm = parseParameterValue(radiusSpec, "0.5 um");
    expect(fromUm.ok).toBe(true);
    if (fromUm.ok) {
      expect(fromUm.canonicalValue).toBeCloseTo(5e-7, 12);
    }

    const fromNm = parseParameterValue(radiusSpec, "500 nm");
    expect(fromNm.ok).toBe(true);
    if (fromNm.ok) {
      expect(fromNm.canonicalValue).toBeCloseTo(5e-7, 12);
    }

    const fromM = parseParameterValue(radiusSpec, "5e-7 m");
    expect(fromM.ok).toBe(true);
    if (fromM.ok) {
      expect(fromM.canonicalValue).toBeCloseTo(5e-7, 12);
    }
  });
});
