/**
 * Parameter Domain Validation & Grid Stepping.
 * Specification: am-inst-parameter-controls-cmj9.
 *
 * Rules:
 * - Never silently clamp or round.
 * - Out-of-domain and off-grid values produce explicit domain explanations and offered options.
 * - Values beyond the visual track but inside the model domain are admitted and marked beyond-track.
 */

import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import type { DomainValidationResult, OffGridDecision } from "./types.ts";

const FLOAT_EPSILON = 1e-12;

/**
 * Validates a numerical value against a ParameterSpec's model domain and visual range.
 */
export function validateDomain(spec: ParameterSpec, value: number): DomainValidationResult {
  if (!Number.isFinite(value)) {
    return {
      valid: false,
      status: "outside",
      isBeyondVisualTrack: false,
      explanation: "Value must be a finite number.",
    };
  }

  const { modelDomain, visualRange } = spec;

  // 1. Enumerated choices
  if (modelDomain.enumerated && modelDomain.enumerated.length > 0) {
    const isMember = modelDomain.enumerated.some(
      (item) => Math.abs(item - value) < FLOAT_EPSILON,
    );
    if (!isMember) {
      const reasonPrefix = modelDomain.reason ? `${modelDomain.reason}: ` : "";
      return {
        valid: false,
        status: "outside",
        isBeyondVisualTrack: false,
        enumerated: modelDomain.enumerated,
        explanation: `${reasonPrefix}Value ${value} is not one of the allowed choices: [${modelDomain.enumerated.join(", ")}].`,
      };
    }
    return {
      valid: true,
      status: "inside",
      isBeyondVisualTrack: value < visualRange.min || value > visualRange.max,
      enumerated: modelDomain.enumerated,
    };
  }

  // 2. Minimum bound
  if (modelDomain.min !== undefined) {
    const minInclusive = modelDomain.minInclusive !== false;
    const violatesMin = minInclusive ? value < modelDomain.min - FLOAT_EPSILON : value <= modelDomain.min + FLOAT_EPSILON;
    if (violatesMin) {
      const reasonPrefix = modelDomain.reason ? `${modelDomain.reason}: ` : "";
      return {
        valid: false,
        status: "outside",
        isBeyondVisualTrack: value < visualRange.min || value > visualRange.max,
        min: modelDomain.min,
        minInclusive,
        explanation: `${reasonPrefix}Value ${value} is below the minimum allowed bound of ${modelDomain.min}${minInclusive ? " (inclusive)" : " (exclusive)"}.`,
      };
    }
  }

  // 3. Maximum bound
  if (modelDomain.max !== undefined) {
    const maxInclusive = modelDomain.maxInclusive !== false;
    const violatesMax = maxInclusive ? value > modelDomain.max + FLOAT_EPSILON : value >= modelDomain.max - FLOAT_EPSILON;
    if (violatesMax) {
      const reasonPrefix = modelDomain.reason ? `${modelDomain.reason}: ` : "";
      return {
        valid: false,
        status: "outside",
        isBeyondVisualTrack: value < visualRange.min || value > visualRange.max,
        max: modelDomain.max,
        maxInclusive,
        explanation: `${reasonPrefix}Value ${value} exceeds the maximum allowed bound of ${modelDomain.max}${maxInclusive ? " (inclusive)" : " (exclusive)"}.`,
      };
    }
  }

  // 4. Boundary check
  let isBoundary = false;
  if (modelDomain.min !== undefined && Math.abs(value - modelDomain.min) < FLOAT_EPSILON) {
    isBoundary = true;
  }
  if (modelDomain.max !== undefined && Math.abs(value - modelDomain.max) < FLOAT_EPSILON) {
    isBoundary = true;
  }

  const isBeyondVisualTrack = value < visualRange.min - FLOAT_EPSILON || value > visualRange.max + FLOAT_EPSILON;

  return {
    valid: true,
    status: isBoundary ? "boundary" : "inside",
    isBeyondVisualTrack,
    min: modelDomain.min,
    max: modelDomain.max,
    minInclusive: modelDomain.minInclusive !== false,
    maxInclusive: modelDomain.maxInclusive !== false,
  };
}

/**
 * Checks whether a numerical value is aligned with a parameter's step or grid mapping.
 * When off-grid, calculates nearest admissible neighbours that satisfy the model domain.
 */
export function checkGridStep(
  spec: ParameterSpec,
  value: number,
  gridStepOverride?: number,
): OffGridDecision {
  if (spec.mapping.kind !== "step") {
    return {
      onGrid: true,
      status: "on-grid",
      offeredNeighbours: [],
    };
  }

  const stepSize =
    gridStepOverride ??
    ("size" in spec.mapping && typeof spec.mapping.size === "number" ? spec.mapping.size : spec.step) ??
    1;

  if (stepSize <= 0 || !Number.isFinite(stepSize)) {
    return {
      onGrid: true,
      status: "on-grid",
      stepSize,
      offeredNeighbours: [],
    };
  }

  // Grid steps are multiples of stepSize from origin (0)
  const base = 0;
  const k = (value - base) / stepSize;
  const nearestK = Math.round(k);
  const gridValue = base + nearestK * stepSize;
  const diff = Math.abs(value - gridValue);

  // Consider on-grid if within floating tolerance
  const isOnGrid = diff < 1e-9 * Math.max(1, Math.abs(stepSize));

  if (isOnGrid) {
    return {
      onGrid: true,
      status: "on-grid",
      stepSize,
      offeredNeighbours: [],
    };
  }

  // Calculate candidate neighbours (floor and ceiling steps)
  const floorK = Math.floor(k);
  const ceilK = Math.ceil(k);

  // Normalize floating precision
  const lowerCand = Number((base + floorK * stepSize).toFixed(10));
  const upperCand = Number((base + ceilK * stepSize).toFixed(10));

  const candidates: number[] = [];
  if (validateDomain(spec, lowerCand).valid) {
    candidates.push(lowerCand);
  }
  if (validateDomain(spec, upperCand).valid && !candidates.includes(upperCand)) {
    candidates.push(upperCand);
  }

  const offeredStr = candidates.length > 0 ? candidates.join(", ") : "none within domain";
  const explanation = `Value ${value} is off the ${stepSize} grid. Admissible options: ${offeredStr} or change the grid step.`;

  return {
    onGrid: false,
    status: "off-grid",
    stepSize,
    offeredNeighbours: Object.freeze(candidates),
    explanation,
  };
}
