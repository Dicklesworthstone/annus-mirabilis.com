/**
 * RepresentationScale validator and formatters (am-inst-2d-view-kit-u75r).
 *
 * Rules:
 * 1. `playbackMultiplier` defines "real time". The label "true rate" or "real time"
 *    renders only when playbackMultiplier is exactly 1.
 * 2. `glyphSize.represents: "none"` is the default. A view may set `represents` to a
 *    quantity id only when calibrated to that quantity extent.
 * 3. `spatialMagnification.factor` is 1 unless amplified. `appliesTo` distinguishes
 *    scene magnification from readout amplification.
 * 4. The same five facts reach the nonvisual summary and the print view.
 * 5. Scale bar is derived from calibrated length and spatialMagnification.
 */

import type { RepresentationScale, SpatialMagnification } from "./types.ts";

export class RepresentationScaleError extends Error {
  readonly field: string;
  constructor(message: string, field: string) {
    super(`RepresentationScale error in "${field}": ${message}`);
    this.name = "RepresentationScaleError";
    this.field = field;
  }
}

/**
 * Validates a RepresentationScale object against the 5 contractual rules.
 */
export function validateRepresentationScale(scale: RepresentationScale): void {
  if (!scale || typeof scale !== "object") {
    throw new RepresentationScaleError("RepresentationScale must be an object", "root");
  }

  // 1. Spatial magnification
  if (!scale.spatialMagnification || typeof scale.spatialMagnification !== "object") {
    throw new RepresentationScaleError("spatialMagnification is required", "spatialMagnification");
  }
  const { appliesTo, factor } = scale.spatialMagnification;
  if (typeof appliesTo !== "string" || appliesTo.trim().length === 0) {
    throw new RepresentationScaleError(
      "appliesTo must be a non-empty string",
      "spatialMagnification.appliesTo",
    );
  }
  if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) {
    throw new RepresentationScaleError(
      "factor must be a positive finite number",
      "spatialMagnification.factor",
    );
  }

  // 2. Simulated elapsed time
  if (!scale.simulatedElapsedTime || typeof scale.simulatedElapsedTime !== "object") {
    throw new RepresentationScaleError("simulatedElapsedTime is required", "simulatedElapsedTime");
  }
  const { quantityId, value, unit } = scale.simulatedElapsedTime;
  if (typeof quantityId !== "string" || quantityId.trim().length === 0) {
    throw new RepresentationScaleError(
      "quantityId must be a non-empty string",
      "simulatedElapsedTime.quantityId",
    );
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RepresentationScaleError(
      "value must be a non-negative finite number",
      "simulatedElapsedTime.value",
    );
  }
  if (typeof unit !== "string") {
    throw new RepresentationScaleError("unit must be a string", "simulatedElapsedTime.unit");
  }

  // 3. Playback multiplier
  if (
    typeof scale.playbackMultiplier !== "number" ||
    !Number.isFinite(scale.playbackMultiplier) ||
    scale.playbackMultiplier <= 0
  ) {
    throw new RepresentationScaleError(
      "playbackMultiplier must be a positive finite number",
      "playbackMultiplier",
    );
  }

  // 4. Glyph size
  if (!scale.glyphSize || typeof scale.glyphSize !== "object") {
    throw new RepresentationScaleError("glyphSize is required", "glyphSize");
  }
  const { drawnPx, represents } = scale.glyphSize;
  if (typeof drawnPx !== "number" || !Number.isFinite(drawnPx) || drawnPx <= 0) {
    throw new RepresentationScaleError(
      "drawnPx must be a positive finite number",
      "glyphSize.drawnPx",
    );
  }
  if (typeof represents !== "string" || represents.trim().length === 0) {
    throw new RepresentationScaleError(
      'represents must be "none" or a valid quantityId',
      "glyphSize.represents",
    );
  }

  // 5. Quantity normalization
  if (!scale.quantityNormalization || typeof scale.quantityNormalization !== "object") {
    throw new RepresentationScaleError(
      "quantityNormalization is required",
      "quantityNormalization",
    );
  }
  const { kind } = scale.quantityNormalization;
  if (typeof kind !== "string" || kind.trim().length === 0) {
    throw new RepresentationScaleError(
      "kind must be a non-empty string",
      "quantityNormalization.kind",
    );
  }
}

/**
 * Formats playback rate into human-readable text.
 * Renders "true rate" or "real time" only when playbackMultiplier is exactly 1.
 */
export function formatPlaybackRate(playbackMultiplier: number): string {
  if (playbackMultiplier === 1) {
    return "true rate (1 s/s)";
  }
  if (playbackMultiplier > 1) {
    const formatted =
      playbackMultiplier % 1 === 0 ? String(playbackMultiplier) : playbackMultiplier.toFixed(2);
    return `${formatted} times faster`;
  }
  const reciprocal = 1 / playbackMultiplier;
  const formatted = reciprocal % 1 === 0 ? String(reciprocal) : reciprocal.toFixed(1);
  return `${formatted} times slower`;
}

/**
 * Formats spatial magnification factor and target into human-readable text.
 */
export function formatSpatialMagnification(mag: SpatialMagnification): string {
  if (mag.factor === 1) {
    return mag.appliesTo === "scene"
      ? "1:1 scene scale (unmagnified)"
      : `${mag.appliesTo} readout at 1:1`;
  }

  const factorStr =
    mag.factor >= 1e6 || mag.factor <= 1e-4
      ? `×10^${Math.round(Math.log10(mag.factor))}`
      : `×${mag.factor.toLocaleString("en-US")}`;

  if (mag.appliesTo === "scene") {
    return `Scene magnified ${factorStr}`;
  }
  return `${mag.appliesTo} amplified ${factorStr}`;
}

export interface ScaleFactRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly note?: string | undefined;
}

/**
 * Extracts the five structured scale facts for accessible tables and print stylesheets.
 */
export function getScaleFactRows(scale: RepresentationScale): readonly ScaleFactRow[] {
  validateRepresentationScale(scale);

  const glyphText =
    scale.glyphSize.represents === "none"
      ? `${scale.glyphSize.drawnPx} px marker (uncalibrated marker, not a physical particle size)`
      : `${scale.glyphSize.drawnPx} px calibrated to ${scale.glyphSize.represents}`;

  const normText =
    scale.quantityNormalization.kind === "none"
      ? "unnormalized counts/values"
      : scale.quantityNormalization.kind;

  return [
    {
      key: "spatialMagnification",
      label: "Spatial magnification",
      value: formatSpatialMagnification(scale.spatialMagnification),
      note: scale.spatialMagnification.note,
    },
    {
      key: "simulatedElapsedTime",
      label: "Simulated elapsed time",
      value: `${scale.simulatedElapsedTime.value} ${scale.simulatedElapsedTime.unit} (${scale.simulatedElapsedTime.quantityId})`,
    },
    {
      key: "playbackMultiplier",
      label: "Playback clock",
      value: formatPlaybackRate(scale.playbackMultiplier),
    },
    {
      key: "glyphSize",
      label: "Glyph size",
      value: glyphText,
    },
    {
      key: "quantityNormalization",
      label: "Quantity normalization",
      value: normText,
      note: scale.quantityNormalization.note,
    },
  ];
}
