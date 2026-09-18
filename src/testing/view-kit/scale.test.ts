import { describe, expect, test } from "bun:test";
import {
  formatPlaybackRate,
  formatSpatialMagnification,
  getScaleFactRows,
  RepresentationScaleError,
  validateRepresentationScale,
} from "../../visuals/kit/scale.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";

function createValidScale(): RepresentationScale {
  return {
    spatialMagnification: {
      appliesTo: "scene",
      factor: 1,
    },
    simulatedElapsedTime: {
      quantityId: "elapsedTime",
      value: 0,
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

describe("RepresentationScale: five independent fields (am-inst-2d-view-kit-u75r)", () => {
  test("a valid 5-field RepresentationScale passes validation", () => {
    const scale = createValidScale();
    expect(() => validateRepresentationScale(scale)).not.toThrow();
  });

  test("playbackMultiplier defines 'real time' / 'true rate' exclusively at factor 1", () => {
    expect(formatPlaybackRate(1)).toBe("true rate (1 s/s)");
    expect(formatPlaybackRate(25)).toBe("25 times faster");
    expect(formatPlaybackRate(2.5)).toBe("2.50 times faster");
    expect(formatPlaybackRate(0.1)).toBe("10 times slower");
    expect(formatPlaybackRate(0.04)).toBe("25 times slower");
  });

  test("glyphSize.represents defaults to 'none' and cannot be empty", () => {
    const scale = createValidScale();
    expect(scale.glyphSize.represents).toBe("none");

    const invalidScale: RepresentationScale = {
      ...scale,
      glyphSize: { drawnPx: 4, represents: "" },
    };
    expect(() => validateRepresentationScale(invalidScale)).toThrow(RepresentationScaleError);
  });

  test("spatialMagnification distinguishes scene magnification from readout amplification", () => {
    expect(formatSpatialMagnification({ appliesTo: "scene", factor: 1 })).toBe(
      "1:1 scene scale (unmagnified)",
    );
    expect(formatSpatialMagnification({ appliesTo: "scene", factor: 1e8 })).toBe(
      "Scene magnified ×10^8",
    );
    expect(formatSpatialMagnification({ appliesTo: "centerOfMassShift", factor: 1e17 })).toBe(
      "centerOfMassShift amplified ×10^17",
    );
  });

  test("scale facts table rows contain all 5 dimensions", () => {
    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1e8, note: "microscope field" },
      simulatedElapsedTime: { quantityId: "t", value: 1.25, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 3, represents: "none" },
      quantityNormalization: { kind: "per-bin-width", note: "density per μm" },
    };

    const rows = getScaleFactRows(scale);
    expect(rows.length).toBe(5);

    const keys = rows.map((r) => r.key);
    expect(keys).toContain("spatialMagnification");
    expect(keys).toContain("simulatedElapsedTime");
    expect(keys).toContain("playbackMultiplier");
    expect(keys).toContain("glyphSize");
    expect(keys).toContain("quantityNormalization");

    const magRow = rows.find((r) => r.key === "spatialMagnification");
    expect(magRow?.note).toBe("microscope field");

    const glyphRow = rows.find((r) => r.key === "glyphSize");
    expect(glyphRow?.value).toContain("uncalibrated marker");
  });

  test("a fixture view omitting each of the 5 fields fails with the view id and field named", () => {
    const valid = createValidScale();
    const viewId = "bm01-microscope";

    const fields: (keyof RepresentationScale)[] = [
      "spatialMagnification",
      "simulatedElapsedTime",
      "playbackMultiplier",
      "glyphSize",
      "quantityNormalization",
    ];

    for (const field of fields) {
      const incomplete = { ...valid };
      delete incomplete[field];

      let errorThrown: RepresentationScaleError | null = null;
      try {
        validateRepresentationScale(incomplete as RepresentationScale, viewId);
      } catch (err) {
        if (err instanceof RepresentationScaleError) {
          errorThrown = err;
        }
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown?.viewId).toBe(viewId);
      expect(errorThrown?.field).toBe(field);
      expect(errorThrown?.message).toContain(viewId);
      expect(errorThrown?.message).toContain(field);
    }
  });

  test("auditPlaybackRateLabel allows 'true rate' / 'real time' only at factor 1; fails at 25 naming multiplier and view id", () => {
    const { auditPlaybackRateLabel } = require("../../visuals/kit/scale.ts");
    const viewId = "bm01-timer";

    // Valid usages
    expect(() => auditPlaybackRateLabel("true rate (1 s/s)", 1, viewId)).not.toThrow();
    expect(() => auditPlaybackRateLabel("real time playback", 1, viewId)).not.toThrow();
    expect(() => auditPlaybackRateLabel("25 times faster", 25, viewId)).not.toThrow();
    expect(() => auditPlaybackRateLabel("10 times slower", 0.1, viewId)).not.toThrow();

    // Invalid usages: rendering true rate or real time at 25
    expect(() => auditPlaybackRateLabel("true rate", 25, viewId)).toThrow(
      /\[View bm01-timer\].*25.*must be exactly 1/,
    );
    expect(() => auditPlaybackRateLabel("real time", 25, viewId)).toThrow(
      /\[View bm01-timer\].*25.*must be exactly 1/,
    );
  });

  test("auditGlyphCaption fails when caption relates glyph size to physical extent while represents is 'none'", () => {
    const { auditGlyphCaption } = require("../../visuals/kit/scale.ts");
    const viewId = "bm01-tracers";
    const uncalibrated = createValidScale(); // glyphSize.represents === "none"

    expect(() =>
      auditGlyphCaption("each dot is one particle, drawn at its true size", uncalibrated, viewId),
    ).toThrow(/\[View bm01-tracers\].*glyphSize\.represents is "none"/);

    expect(() =>
      auditGlyphCaption("dots represent physical particle radius", uncalibrated, viewId),
    ).toThrow(/\[View bm01-tracers\].*glyphSize\.represents is "none"/);

    // Passes when calibrated
    const calibrated: RepresentationScale = {
      ...uncalibrated,
      glyphSize: {
        drawnPx: 4,
        represents: "particleRadius",
      },
    };
    expect(() =>
      auditGlyphCaption("each dot is one particle, drawn at its true size", calibrated, viewId),
    ).not.toThrow();
  });

  test("auditScaleBarCalibration validates bar length equals calibrated * base * factor; disagrees fail naming view id", () => {
    const { auditScaleBarCalibration } = require("../../visuals/kit/scale.ts");
    const viewId = "bm01-scale-bar";

    // 1 μm * 50 px/μm * 2 factor = 100 px
    expect(() => auditScaleBarCalibration(100, 50, 1, 2, 0.5, viewId)).not.toThrow();

    // Disagreement: rendered 60 px when expected is 100 px
    expect(() => auditScaleBarCalibration(60, 50, 1, 2, 0.5, viewId)).toThrow(
      /\[View bm01-scale-bar\] Scale bar length 60px disagrees with expected 100px/,
    );
  });
});

