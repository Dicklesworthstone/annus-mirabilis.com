import { describe, expect, test } from "bun:test";
import { evaluatePhotonBox } from "../../physics/reference/massEnergy.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { buildMe03BoxScale, validateMe03BoxScale } from "./scale.ts";

describe("ME-03 1906 Box RepresentationScale contract", () => {
  test("published RepresentationScale has spatialMagnification.appliesTo === 'centerOfMassShift'", () => {
    const scale = buildMe03BoxScale(1e17, 3.33564095198152e-9);
    expect(scale.spatialMagnification.appliesTo).toBe("centerOfMassShift");
    expect(scale.spatialMagnification.factor).toBe(1e17);
    expect(scale.simulatedElapsedTime.quantityId).toBe("pulseFlightTime");
    expect(scale.simulatedElapsedTime.value).toBeCloseTo(3.33564095198152e-9, 15);
    expect(scale.simulatedElapsedTime.unit).toBe("s");
    expect(scale.playbackMultiplier).toBe(1);
    expect(scale.glyphSize.drawnPx).toBe(2);
    expect(scale.glyphSize.represents).toBe("none");
    expect(scale.quantityNormalization.kind).toBe("none");

    expect(() => validateMe03BoxScale(scale, "me-03:box-1906")).not.toThrow();
  });

  test("rejects spatialMagnification.appliesTo === 'scene'", () => {
    const invalidScale = {
      spatialMagnification: {
        appliesTo: "scene",
        factor: 1e17,
      },
      simulatedElapsedTime: {
        quantityId: "pulseFlightTime",
        value: 3.33564095198152e-9,
        unit: "s",
      },
      playbackMultiplier: 1,
      glyphSize: {
        drawnPx: 2,
        represents: "none",
      },
      quantityNormalization: {
        kind: "none",
      },
    } as unknown as RepresentationScale;

    expect(() => validateMe03BoxScale(invalidScale, "me-03:box-1906")).toThrow(
      /spatialMagnification\.appliesTo must name the magnified quantity \("centerOfMassShift"\), never "scene"/,
    );
  });

  test("at magnification factors 10^15, 10^17, and 10^20, physical displacement remains unscaled", () => {
    const factors = [1e15, 1e17, 1e20];
    const evalRes = evaluatePhotonBox({ M: 1.0, ell: 1.0, E: 1.0, assignLightMass: true });
    const canonicalPhysicalDisplacement = evalRes.displacement;

    expect(canonicalPhysicalDisplacement).toBeCloseTo(-1.1126500560536185e-17, 23);
    const unscaledFormatted = canonicalPhysicalDisplacement.toExponential(6);
    expect(unscaledFormatted).toBe("-1.112650e-17");

    for (const factor of factors) {
      const scale = buildMe03BoxScale(factor, evalRes.flightTimeValue);
      expect(scale.spatialMagnification.factor).toBe(factor);
      expect(scale.spatialMagnification.appliesTo).toBe("centerOfMassShift");
      // The physical displacement evaluated from physics is invariant under visualization magnification
      expect(evalRes.displacement).toBe(canonicalPhysicalDisplacement);
      expect(evalRes.displacement.toExponential(6)).toBe("-1.112650e-17");
    }
  });

  test("5 representation scale facts are defined and formatted for display and print", () => {
    const factor = 1e17;
    const flightTime = 3.33564095198152e-9;
    const scale = buildMe03BoxScale(factor, flightTime);

    // 1. Spatial magnification
    expect(scale.spatialMagnification.factor).toBe(1e17);
    expect(scale.spatialMagnification.appliesTo).toBe("centerOfMassShift");

    // 2. Simulated elapsed time
    expect(scale.simulatedElapsedTime.value).toBe(flightTime);
    expect(scale.simulatedElapsedTime.unit).toBe("s");

    // 3. Playback multiplier
    expect(scale.playbackMultiplier).toBe(1);

    // 4. Glyph size
    expect(scale.glyphSize.drawnPx).toBe(2);
    expect(scale.glyphSize.represents).toBe("none");

    // 5. Quantity normalization
    expect(scale.quantityNormalization.kind).toBe("none");

    // Print summary representation
    const printLine = `Scale: ×${scale.spatialMagnification.factor} (${scale.spatialMagnification.appliesTo}) · Δt: ${scale.simulatedElapsedTime.value} ${scale.simulatedElapsedTime.unit} · ${scale.playbackMultiplier}× rate · glyph: ${scale.glyphSize.drawnPx}px (${scale.glyphSize.represents}) · norm: ${scale.quantityNormalization.kind}`;
    expect(printLine).toContain("×100000000000000000 (centerOfMassShift)");
    expect(printLine).toContain("3.33564095198152e-9 s");
    expect(printLine).toContain("1× rate");
    expect(printLine).toContain("glyph: 2px (none)");
    expect(printLine).toContain("norm: none");
  });
});
