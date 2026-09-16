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

  test("validation rejects negative or nonfinite parameters", () => {
    const scale = createValidScale();

    expect(() =>
      validateRepresentationScale({
        ...scale,
        playbackMultiplier: -1,
      }),
    ).toThrow(RepresentationScaleError);

    expect(() =>
      validateRepresentationScale({
        ...scale,
        spatialMagnification: { appliesTo: "scene", factor: 0 },
      }),
    ).toThrow(RepresentationScaleError);

    expect(() =>
      validateRepresentationScale({
        ...scale,
        simulatedElapsedTime: { quantityId: "t", value: -5, unit: "s" },
      }),
    ).toThrow(RepresentationScaleError);
  });
});
