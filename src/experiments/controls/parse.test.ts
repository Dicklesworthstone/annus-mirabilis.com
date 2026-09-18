import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import {
  formatParameterValue,
  getCanonicalBaseUnit,
  normalizeUnit,
  parseParameterValue,
  serializeParameterValue,
  toCanonicalValue,
  toDisplayUnitValue,
} from "./parse.ts";

describe("parse.ts Unit Tests (am-inst-parameter-controls-cmj9)", () => {
  const viscositySpec: ParameterSpec = {
    id: "eta",
    label: "Viscosity",
    accessibleName: "Dynamic viscosity",
    accessibleDescription: "Viscosity of suspension liquid",
    quantityId: "viscosity",
    displayUnit: "mPa s",
    modelDomain: { min: 0.0001, max: 0.05 },
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
    accessibleDescription: "Hydrodynamic particle radius",
    quantityId: "particleRadius",
    displayUnit: "um",
    modelDomain: { min: 1e-8, max: 1e-5 },
    visualRange: { min: 1e-7, max: 5e-6 },
    default: 5e-7,
    mapping: { kind: "log", base: 10 },
    role: "independent",
    commandClass: "setup-change",
  };

  const temperatureSpec: ParameterSpec = {
    id: "T",
    label: "Temperature",
    accessibleName: "Absolute temperature",
    accessibleDescription: "Temperature in Kelvin",
    quantityId: "temperature",
    displayUnit: "K",
    modelDomain: { min: 270, max: 350 },
    visualRange: { min: 273, max: 330 },
    default: 290.15,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const seedSpec: ParameterSpec = {
    id: "seed",
    label: "Seed",
    accessibleName: "Random stream seed",
    accessibleDescription: "64-bit decimal seed",
    quantityId: "streamSeed",
    displayUnit: "",
    modelDomain: { reason: "Any canonical unsigned 64-bit decimal string" },
    visualRange: { min: 0, max: 1 },
    default: "1905",
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const intervalSpec: ParameterSpec = {
    id: "interval",
    label: "Observation interval",
    accessibleName: "Observation interval",
    accessibleDescription: "Time interval between observations",
    quantityId: "observationInterval",
    displayUnit: "s",
    modelDomain: { min: 0.01, max: 60.0 },
    visualRange: { min: 0.02, max: 10.0 },
    default: 1.0,
    mapping: { kind: "step", size: 0.02 },
    role: "independent",
    commandClass: "measurement-change",
  };

  test("unit normalization and canonical base unit resolution", () => {
    expect(normalizeUnit("mPa·s")).toBe("mPa*s");
    expect(normalizeUnit("mPa s")).toBe("mPa*s");
    expect(normalizeUnit("µm")).toBe("um");
    expect(normalizeUnit("μm")).toBe("um");
    expect(normalizeUnit("°C")).toBe("degC");

    expect(getCanonicalBaseUnit(viscositySpec)).toBe("Pa*s");
    expect(getCanonicalBaseUnit(radiusSpec)).toBe("m");
    expect(getCanonicalBaseUnit(temperatureSpec)).toBe("K");
    expect(getCanonicalBaseUnit(intervalSpec)).toBe("s");
  });

  test("1.35e-3 Pa*s and 5e-7 m round-trip in canonical SI with exact formatting and serialization", () => {
    // 1. Viscosity: 1.35e-3 Pa*s (canonical SI)
    const parsedViscSi = parseParameterValue(viscositySpec, "1.35e-3 Pa*s");
    expect(parsedViscSi.ok).toBe(true);
    if (parsedViscSi.ok) {
      expect(parsedViscSi.canonicalValue).toBe(0.00135);
      const serialized = serializeParameterValue(viscositySpec, parsedViscSi.canonicalValue);
      expect(Number(serialized)).toBe(0.00135);
      // Display value in mPa s is 1.35
      expect(parsedViscSi.displayValue).toBe("1.35");
    }

    // Viscosity: 1.35 mPa·s
    const parsedViscMpa = parseParameterValue(viscositySpec, "1.35 mPa·s");
    expect(parsedViscMpa.ok).toBe(true);
    if (parsedViscMpa.ok) {
      expect(parsedViscMpa.canonicalValue).toBe(0.00135);
    }

    // Viscosity: typed unit-less "1.35" interpreted in displayUnit (mPa s)
    const parsedViscUnitless = parseParameterValue(viscositySpec, "1.35");
    expect(parsedViscUnitless.ok).toBe(true);
    if (parsedViscUnitless.ok) {
      expect(parsedViscUnitless.canonicalValue).toBe(0.00135);
    }

    // 2. Particle radius: 5e-7 m
    const parsedRadSi = parseParameterValue(radiusSpec, "5e-7 m");
    expect(parsedRadSi.ok).toBe(true);
    if (parsedRadSi.ok) {
      expect(parsedRadSi.canonicalValue).toBe(5e-7);
      const serialized = serializeParameterValue(radiusSpec, parsedRadSi.canonicalValue);
      expect(Number(serialized)).toBe(5e-7);
      // Display in um is 0.5
      expect(parsedRadSi.displayValue).toBe("0.5");
    }

    // Particle radius: 500 nm
    const parsedRadNm = parseParameterValue(radiusSpec, "500 nm");
    expect(parsedRadNm.ok).toBe(true);
    if (parsedRadNm.ok) {
      expect(parsedRadNm.canonicalValue).toBe(5e-7);
    }

    // Particle radius: 0.5 um
    const parsedRadUm = parseParameterValue(radiusSpec, "0.5 um");
    expect(parsedRadUm.ok).toBe(true);
    if (parsedRadUm.ok) {
      expect(parsedRadUm.canonicalValue).toBe(5e-7);
    }
  });

  test("toDisplayUnitValue and toCanonicalValue adapters convert accurately", () => {
    // 0.00135 Pa*s -> 1.35 mPa s
    expect(toDisplayUnitValue(viscositySpec, 0.00135)).toBeCloseTo(1.35, 10);
    // 1.35 mPa s -> 0.00135 Pa*s
    expect(toCanonicalValue(viscositySpec, 1.35)).toBeCloseTo(0.00135, 10);

    // 5e-7 m -> 0.5 um
    expect(toDisplayUnitValue(radiusSpec, 5e-7)).toBeCloseTo(0.5, 10);
    // 0.5 um -> 5e-7 m
    expect(toCanonicalValue(radiusSpec, 0.5)).toBeCloseTo(5e-7, 10);
  });

  test("formatParameterValue handles scientific notation for micro quantities and clean fixed for macro quantities", () => {
    expect(formatParameterValue(radiusSpec, 5e-7)).toBe("0.5"); // 0.5 um
    expect(formatParameterValue(viscositySpec, 0.00135)).toBe("1.35"); // 1.35 mPa s
    expect(formatParameterValue(temperatureSpec, 290.15)).toBe("290.15");
    expect(formatParameterValue(seedSpec, "18446744073709551615")).toBe("18446744073709551615");
    expect(formatParameterValue(temperatureSpec, Number.NaN)).toBe("NaN");
  });

  test("parseParameterValue recognizes beyond-track values and sets isBeyondVisualTrack", () => {
    // Viscosity visual range is [0.0005, 0.02] Pa*s (0.5 to 20 mPa s).
    // Type 35 mPa s (= 0.035 Pa*s): within model domain [0.0001, 0.05] but beyond visual track!
    const beyondTrack = parseParameterValue(viscositySpec, "35 mPa s");
    expect(beyondTrack.ok).toBe(true);
    if (beyondTrack.ok) {
      expect(beyondTrack.canonicalValue).toBe(0.035);
      expect(beyondTrack.isBeyondVisualTrack).toBe(true);
    }

    // Inside visual track
    const insideTrack = parseParameterValue(viscositySpec, "10 mPa s");
    expect(insideTrack.ok).toBe(true);
    if (insideTrack.ok) {
      expect(insideTrack.canonicalValue).toBe(0.01);
      expect(insideTrack.isBeyondVisualTrack).toBe(false);
    }
  });

  test("parseParameterValue refuses out-of-domain and off-grid values with explicit errors and explanations", () => {
    // Out of domain: 100 mPa s (= 0.1 Pa*s > max 0.05 Pa*s)
    const outOfDomain = parseParameterValue(viscositySpec, "100 mPa s");
    expect(outOfDomain.ok).toBe(false);
    if (!outOfDomain.ok) {
      expect(outOfDomain.error).toBe("out-of-domain");
      expect(outOfDomain.explanation).toContain("exceeds the maximum allowed bound of 0.05");
    }

    // Off grid: 0.015 s on 0.02 s grid
    const offGrid = parseParameterValue(intervalSpec, "0.015 s");
    expect(offGrid.ok).toBe(false);
    if (!offGrid.ok) {
      expect(offGrid.error).toBe("off-grid");
      expect(offGrid.explanation).toContain("off the 0.02 grid");
      expect(offGrid.offeredNeighbours).toContain(0.02);
    }

    // Empty input
    const empty = parseParameterValue(viscositySpec, "   ");
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toBe("empty-input");
    }

    // Invalid format
    const gibberish = parseParameterValue(viscositySpec, "invalid_num");
    expect(gibberish.ok).toBe(false);
    if (!gibberish.ok) {
      expect(gibberish.error).toBe("invalid-number-format");
    }
  });

  test("seed parsing strictly enforces canonical unsigned 64-bit decimal format", () => {
    // Valid boundary values
    const minSeed = parseParameterValue(seedSpec, "0");
    expect(minSeed.ok).toBe(true);
    if (minSeed.ok) expect(minSeed.canonicalValue).toBe("0");

    const maxSeed = parseParameterValue(seedSpec, "18446744073709551615");
    expect(maxSeed.ok).toBe(true);
    if (maxSeed.ok) expect(maxSeed.canonicalValue).toBe("18446744073709551615");

    const regularSeed = parseParameterValue(seedSpec, "1905");
    expect(regularSeed.ok).toBe(true);
    if (regularSeed.ok) expect(regularSeed.canonicalValue).toBe("1905");

    // Invalid seeds: negative, spaces, leading zeros, exponents, overflow
    for (const invalid of ["-1", " 1", "01", "1e3", "18446744073709551616", "9".repeat(25)]) {
      const res = parseParameterValue(seedSpec, invalid);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.explanation).toContain("canonical 64-bit unsigned decimal integer");
      }
    }
  });
});
