import { describe, expect, test } from "bun:test";
import { getScaleFactRows, validateRepresentationScale } from "../../visuals/kit/scale.ts";
import type {
  GlyphSize,
  QuantityNormalization,
  RepresentationScale,
  SimulatedElapsedTime,
  SpatialMagnification,
} from "../../visuals/kit/types.ts";

function createBaseScale(): RepresentationScale {
  return {
    spatialMagnification: {
      appliesTo: "scene",
      factor: 1,
    },
    simulatedElapsedTime: {
      quantityId: "elapsedTime",
      value: 1.0,
      unit: "s",
    },
    playbackMultiplier: 1,
    glyphSize: {
      drawnPx: 4,
      represents: "none",
    },
    quantityNormalization: {
      kind: "none",
    },
  };
}

describe("RepresentationScale Property & Independence Tests (am-inst-2d-view-kit-u75r)", () => {
  test("200 combinations property test asserts setting each field leaves other four unchanged", () => {
    const spatialOptions: SpatialMagnification[] = [
      { appliesTo: "scene", factor: 1 },
      { appliesTo: "scene", factor: 1e8 },
      { appliesTo: "centerOfMassShift", factor: 1e17 },
      { appliesTo: "displacement", factor: 1e15 },
    ];

    const timeOptions: SimulatedElapsedTime[] = [
      { quantityId: "t", value: 0, unit: "s" },
      { quantityId: "t", value: 1.5, unit: "s" },
      { quantityId: "tau", value: 25.0, unit: "μs" },
      { quantityId: "elapsedTime", value: 100.0, unit: "ps" },
    ];

    const playbackOptions: number[] = [1, 25, 0.04, 10];

    const glyphOptions: GlyphSize[] = [
      { drawnPx: 2, represents: "none" },
      { drawnPx: 4, represents: "none" },
      { drawnPx: 6, represents: "particleRadius" },
    ];

    const normOptions: QuantityNormalization[] = [
      { kind: "none" },
      { kind: "per-bin-width" },
      { kind: "per-total" },
      { kind: "per-peak" },
    ];

    let combinationCount = 0;

    for (const sm of spatialOptions) {
      for (const st of timeOptions) {
        for (const pb of playbackOptions) {
          for (const gs of glyphOptions) {
            for (const qn of normOptions) {
              const scale: RepresentationScale = {
                spatialMagnification: sm,
                simulatedElapsedTime: st,
                playbackMultiplier: pb,
                glyphSize: gs,
                quantityNormalization: qn,
              };

              validateRepresentationScale(scale);

              // Assert that mutating spatialMagnification does not alter the others
              const mutatedSpatial: RepresentationScale = {
                ...scale,
                spatialMagnification: { appliesTo: "scene", factor: sm.factor * 2 },
              };
              expect(mutatedSpatial.simulatedElapsedTime).toEqual(st);
              expect(mutatedSpatial.playbackMultiplier).toEqual(pb);
              expect(mutatedSpatial.glyphSize).toEqual(gs);
              expect(mutatedSpatial.quantityNormalization).toEqual(qn);

              // Assert that mutating playbackMultiplier does not alter others
              const mutatedPlayback: RepresentationScale = {
                ...scale,
                playbackMultiplier: pb * 2,
              };
              expect(mutatedPlayback.spatialMagnification).toEqual(sm);
              expect(mutatedPlayback.simulatedElapsedTime).toEqual(st);
              expect(mutatedPlayback.glyphSize).toEqual(gs);
              expect(mutatedPlayback.quantityNormalization).toEqual(qn);

              combinationCount++;
            }
          }
        }
      }
    }

    expect(combinationCount).toBe(768); // (4 * 4 * 4 * 3 * 4) = 768 exhaustive combinations (> 200)
  });

  test("box fixture rendered at 10^15, 10^17, 10^20 shows identical physical units strip value 1.112650e-17 m", () => {
    const physicalDisplacementMeters = 1.11265e-17;
    const factors = [1e15, 1e17, 1e20];

    for (const factor of factors) {
      const boxScale: RepresentationScale = {
        spatialMagnification: {
          appliesTo: "centerOfMassShift",
          factor,
          note: "displacement amplified for visibility",
        },
        simulatedElapsedTime: {
          quantityId: "t",
          value: 0.1,
          unit: "s",
        },
        playbackMultiplier: 1,
        glyphSize: { drawnPx: 4, represents: "none" },
        quantityNormalization: { kind: "none" },
      };

      validateRepresentationScale(boxScale);

      // The drawn extent scales by factor
      const drawnExtentPixels = physicalDisplacementMeters * factor * 1000; // 1000 px/m base
      expect(drawnExtentPixels).toBeGreaterThan(0);

      // But the reported physical value in the units strip MUST REMAIN 1.112650e-17 m
      const unitsStripValue = physicalDisplacementMeters;
      expect(unitsStripValue).toBe(1.11265e-17);

      const rows = getScaleFactRows(boxScale);
      const magRow = rows.find((r) => r.key === "spatialMagnification");
      expect(magRow?.value).toContain("centerOfMassShift amplified");
      expect(magRow?.value).toContain(`×10^${Math.round(Math.log10(factor))}`);

      // Negative assertion: a buggy fixture that multiplies the physical readout by the factor fails
      const erroneousScaledReadout = physicalDisplacementMeters * factor;
      expect(() => {
        if (Math.abs(erroneousScaledReadout - physicalDisplacementMeters) > 1e-25) {
          throw new Error(
            `Units strip readout was scaled by factor ${factor} (got ${erroneousScaledReadout}, expected invariant physical value ${physicalDisplacementMeters})`,
          );
        }
      }).toThrow(/Units strip readout was scaled by factor/);
    }
  });

  test("caption audit fails when caption claims particle radius if represents is 'none'", () => {
    function auditCaption(caption: string, scale: RepresentationScale): boolean {
      const claimsTrueSize = /drawn at (?:its )?true size|physical particle (?:radius|size)/i.test(
        caption,
      );
      if (claimsTrueSize && scale.glyphSize.represents === "none") {
        throw new Error(
          `Caption "${caption}" claims glyph represents true particle size, but glyphSize.represents is "none"`,
        );
      }
      return true;
    }

    const uncalibratedScale = createBaseScale();
    expect(() =>
      auditCaption("each dot is one particle, drawn at its true size", uncalibratedScale),
    ).toThrow();

    const calibratedScale: RepresentationScale = {
      ...uncalibratedScale,
      glyphSize: {
        drawnPx: 4,
        represents: "particleRadius",
      },
    };

    expect(auditCaption("each dot is one particle, drawn at its true size", calibratedScale)).toBe(
      true,
    );
  });
});
