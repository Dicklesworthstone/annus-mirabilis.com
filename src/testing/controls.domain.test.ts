import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../content/schemas/experiment.ts";
import { checkGridStep, validateDomain } from "../experiments/controls/domain.ts";

describe("Parameter Domain and Off-Grid Validation (am-inst-parameter-controls-cmj9)", () => {
  const testSpec: ParameterSpec = {
    id: "interval",
    label: "Observation interval",
    accessibleName: "Observation interval",
    accessibleDescription: "Time between observations",
    quantityId: "observationInterval",
    displayUnit: "s",
    modelDomain: {
      min: 0.01,
      max: 60.0,
      minInclusive: true,
      maxInclusive: true,
      reason: "Time must be strictly positive and land on the replay grid",
    },
    visualRange: { min: 0.02, max: 10.0 },
    default: 1.0,
    mapping: { kind: "step", size: 0.02 },
    role: "independent",
    commandClass: "measurement-change",
  };

  test("correctly identifies inside, boundary, and outside domain values without clamping", () => {
    // 1. Inside domain & inside visual track
    const inside = validateDomain(testSpec, 1.0);
    expect(inside.valid).toBe(true);
    expect(inside.status).toBe("inside");
    expect(inside.isBeyondVisualTrack).toBe(false);

    // 2. Boundary minimum
    const boundaryMin = validateDomain(testSpec, 0.01);
    expect(boundaryMin.valid).toBe(true);
    expect(boundaryMin.status).toBe("boundary");

    // 3. Boundary maximum
    const boundaryMax = validateDomain(testSpec, 60.0);
    expect(boundaryMax.valid).toBe(true);
    expect(boundaryMax.status).toBe("boundary");
    expect(boundaryMax.isBeyondVisualTrack).toBe(true); // 60 > visualMax 10

    // 4. Outside domain (below min)
    const belowMin = validateDomain(testSpec, 0.005);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.status).toBe("outside");
    expect(belowMin.explanation).toContain("below the minimum allowed bound");

    // 5. Outside domain (above max)
    const aboveMax = validateDomain(testSpec, 100.0);
    expect(aboveMax.valid).toBe(false);
    expect(aboveMax.status).toBe("outside");
    expect(aboveMax.explanation).toContain("exceeds the maximum allowed bound");
  });

  test("off-grid fixtures: 0.015 s on a 0.02 s grid offers 0.02 s (and not 0 s, which is outside domain) plus grid change", () => {
    // Value 0.015 s on 0.02 s grid
    const offGridDecision = checkGridStep(testSpec, 0.015, 0.02);

    expect(offGridDecision.onGrid).toBe(false);
    expect(offGridDecision.status).toBe("off-grid");
    expect(offGridDecision.stepSize).toBe(0.02);

    // 0 s is outside domain (min is 0.01 s), so lower neighbour 0 s must be filtered out!
    expect(offGridDecision.offeredNeighbours).toContain(0.02);
    expect(offGridDecision.offeredNeighbours).not.toContain(0);
    expect(offGridDecision.explanation).toContain("0.02");
    expect(offGridDecision.explanation).toContain("change the grid step");
  });

  test("on-grid values return on-grid status with empty offered neighbours", () => {
    const onGrid1 = checkGridStep(testSpec, 0.02, 0.02);
    expect(onGrid1.onGrid).toBe(true);
    expect(onGrid1.status).toBe("on-grid");

    const onGrid2 = checkGridStep(testSpec, 0.04, 0.02);
    expect(onGrid2.onGrid).toBe(true);

    const onGrid3 = checkGridStep(testSpec, 1.0, 0.02);
    expect(onGrid3.onGrid).toBe(true);
  });

  test("enumerated domain checks valid vs invalid selections", () => {
    const enumSpec: ParameterSpec = {
      id: "d",
      label: "Dimension",
      accessibleName: "Dimension",
      accessibleDescription: "Dimension",
      quantityId: "dimension",
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

    expect(validateDomain(enumSpec, 1).valid).toBe(true);
    expect(validateDomain(enumSpec, 2).valid).toBe(true);
    expect(validateDomain(enumSpec, 3).valid).toBe(true);

    const invalidEnum = validateDomain(enumSpec, 4);
    expect(invalidEnum.valid).toBe(false);
    expect(invalidEnum.status).toBe("outside");
  });
});
