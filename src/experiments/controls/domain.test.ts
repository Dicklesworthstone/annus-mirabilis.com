import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import { checkGridStep, validateDomain } from "./domain.ts";

describe("domain.ts Unit Tests (am-inst-parameter-controls-cmj9)", () => {
  const temperatureSpec: ParameterSpec = {
    id: "T",
    label: "Temperature",
    accessibleName: "Absolute temperature",
    accessibleDescription: "Fluid temperature in Kelvin",
    quantityId: "temperature",
    displayUnit: "K",
    modelDomain: {
      min: 270,
      max: 350,
      minInclusive: true,
      maxInclusive: true,
      reason: "Liquid state of water at ordinary pressure",
    },
    visualRange: { min: 273, max: 330 },
    default: 290.15,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const intervalSpec: ParameterSpec = {
    id: "interval",
    label: "Observation interval",
    accessibleName: "Observation interval",
    accessibleDescription: "Delta t in seconds",
    quantityId: "observationInterval",
    displayUnit: "s",
    modelDomain: {
      min: 0.01,
      max: 60.0,
      minInclusive: true,
      maxInclusive: true,
      reason: "Time must be positive and land on replay grid",
    },
    visualRange: { min: 0.02, max: 10.0 },
    default: 1.0,
    mapping: { kind: "step", size: 0.02 },
    role: "independent",
    commandClass: "measurement-change",
  };

  const exclusiveBoundsSpec: ParameterSpec = {
    id: "freq",
    label: "Frequency",
    accessibleName: "Light frequency",
    accessibleDescription: "Frequency in Hz",
    quantityId: "frequency",
    displayUnit: "Hz",
    modelDomain: {
      min: 100,
      max: 1000,
      minInclusive: false,
      maxInclusive: false,
      reason: "Strictly inside open interval (100, 1000)",
    },
    visualRange: { min: 200, max: 800 },
    default: 500,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  const enumSpec: ParameterSpec = {
    id: "d",
    label: "Dimension",
    accessibleName: "Displayed dimension",
    accessibleDescription: "Number of coordinates",
    quantityId: "displayedDimension",
    displayUnit: "",
    modelDomain: {
      enumerated: [1, 2, 3],
      reason: "Must be 1, 2, or 3",
    },
    visualRange: { min: 1, max: 3 },
    default: 1,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "measurement-change",
  };

  test("distinguishes inside, boundary, beyond visual track, and outside domain without clamping", () => {
    // 1. Inside visual track and inside model domain
    const inside = validateDomain(temperatureSpec, 290.15);
    expect(inside.valid).toBe(true);
    expect(inside.status).toBe("inside");
    expect(inside.isBeyondVisualTrack).toBe(false);

    // 2. Boundary minimum
    const boundaryMin = validateDomain(temperatureSpec, 270);
    expect(boundaryMin.valid).toBe(true);
    expect(boundaryMin.status).toBe("boundary");
    expect(boundaryMin.isBeyondVisualTrack).toBe(true); // 270 < visualMin 273

    // 3. Boundary maximum
    const boundaryMax = validateDomain(temperatureSpec, 350);
    expect(boundaryMax.valid).toBe(true);
    expect(boundaryMax.status).toBe("boundary");
    expect(boundaryMax.isBeyondVisualTrack).toBe(true); // 350 > visualMax 330

    // 4. Inside model domain but beyond visual range upper bound (beyond-track)
    const upperBeyond = validateDomain(temperatureSpec, 340);
    expect(upperBeyond.valid).toBe(true);
    expect(upperBeyond.status).toBe("inside");
    expect(upperBeyond.isBeyondVisualTrack).toBe(true);

    // 5. Inside model domain but below visual range lower bound (beyond-track)
    const lowerBeyond = validateDomain(temperatureSpec, 271);
    expect(lowerBeyond.valid).toBe(true);
    expect(lowerBeyond.status).toBe("inside");
    expect(lowerBeyond.isBeyondVisualTrack).toBe(true);

    // 6. Outside model domain (above max)
    const aboveMax = validateDomain(temperatureSpec, 360);
    expect(aboveMax.valid).toBe(false);
    expect(aboveMax.status).toBe("outside");
    expect(aboveMax.explanation).toContain("exceeds the maximum allowed bound of 350");

    // 7. Outside model domain (below min)
    const belowMin = validateDomain(temperatureSpec, 260);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.status).toBe("outside");
    expect(belowMin.explanation).toContain("below the minimum allowed bound of 270");
  });

  test("handles exclusive min/max boundaries correctly", () => {
    // Exact lower bound with minInclusive: false -> invalid
    const atMin = validateDomain(exclusiveBoundsSpec, 100);
    expect(atMin.valid).toBe(false);
    expect(atMin.status).toBe("outside");

    // Just inside lower bound
    const justAboveMin = validateDomain(exclusiveBoundsSpec, 100.01);
    expect(justAboveMin.valid).toBe(true);

    // Exact upper bound with maxInclusive: false -> invalid
    const atMax = validateDomain(exclusiveBoundsSpec, 1000);
    expect(atMax.valid).toBe(false);
    expect(atMax.status).toBe("outside");

    // Just inside upper bound
    const justBelowMax = validateDomain(exclusiveBoundsSpec, 999.99);
    expect(justBelowMax.valid).toBe(true);
  });

  test("rejects non-finite numbers (NaN, Infinity, -Infinity)", () => {
    expect(validateDomain(temperatureSpec, Number.NaN).valid).toBe(false);
    expect(validateDomain(temperatureSpec, Number.POSITIVE_INFINITY).valid).toBe(false);
    expect(validateDomain(temperatureSpec, Number.NEGATIVE_INFINITY).valid).toBe(false);
  });

  test("validates enumerated model domain options", () => {
    expect(validateDomain(enumSpec, 1).valid).toBe(true);
    expect(validateDomain(enumSpec, 2).valid).toBe(true);
    expect(validateDomain(enumSpec, 3).valid).toBe(true);

    const invalid = validateDomain(enumSpec, 4);
    expect(invalid.valid).toBe(false);
    expect(invalid.status).toBe("outside");
    expect(invalid.explanation).toContain("not one of the allowed choices");
  });

  test("checkGridStep handles on-grid, off-grid offered neighbours, and grid step overrides", () => {
    // Non-step mapping returns onGrid: true
    expect(checkGridStep(temperatureSpec, 290.15).onGrid).toBe(true);

    // On-grid step values
    expect(checkGridStep(intervalSpec, 0.02).onGrid).toBe(true);
    expect(checkGridStep(intervalSpec, 0.04).onGrid).toBe(true);
    expect(checkGridStep(intervalSpec, 1.0).onGrid).toBe(true);

    // Off-grid: 0.015 s on 0.02 s grid
    // Lower multiple is 0.00 s, which is OUTSIDE modelDomain (min is 0.01 s).
    // Upper multiple is 0.02 s, which is INSIDE modelDomain.
    const offGrid = checkGridStep(intervalSpec, 0.015);
    expect(offGrid.onGrid).toBe(false);
    expect(offGrid.status).toBe("off-grid");
    expect(offGrid.offeredNeighbours).toEqual([0.02]);
    expect(offGrid.offeredNeighbours).not.toContain(0);
    expect(offGrid.explanation).toContain("0.02");
    expect(offGrid.explanation).toContain("change the grid step");

    // Grid step override (e.g. from dependent parameter h = 0.05 s)
    const onOverridden = checkGridStep(intervalSpec, 0.15, 0.05);
    expect(onOverridden.onGrid).toBe(true);

    const offOverridden = checkGridStep(intervalSpec, 0.12, 0.05);
    expect(offOverridden.onGrid).toBe(false);
    expect(offOverridden.stepSize).toBe(0.05);
    expect(offOverridden.offeredNeighbours).toContain(0.1);
    expect(offOverridden.offeredNeighbours).toContain(0.15);
  });
});
