import { validateRepresentationScale } from "../../visuals/kit/scale.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";

export function buildMe03BoxScale(
  magnification: number,
  flightTime = 3.33564095198152e-9,
): RepresentationScale {
  return Object.freeze({
    spatialMagnification: Object.freeze({
      appliesTo: "centerOfMassShift",
      factor: magnification,
      note: "Displacement magnified for visibility; does not scale the physical value",
    }),
    simulatedElapsedTime: Object.freeze({
      quantityId: "pulseFlightTime",
      value: flightTime,
      unit: "s",
    }),
    playbackMultiplier: 1,
    glyphSize: Object.freeze({
      drawnPx: 2,
      represents: "none",
    }),
    quantityNormalization: Object.freeze({
      kind: "none",
    }),
  });
}

export function validateMe03BoxScale(scale: RepresentationScale, viewId = "me-03:box-1906"): void {
  validateRepresentationScale(scale);
  if (scale.spatialMagnification.appliesTo === "scene") {
    throw new Error(
      `View "${viewId}" validation failure: spatialMagnification.appliesTo must name the magnified quantity ("centerOfMassShift"), never "scene"`,
    );
  }
}
