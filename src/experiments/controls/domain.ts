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
import { withinTolerance } from "../../units/tolerance.ts";
import type { DomainValidationResult, OffGridDecision } from "./types.ts";

const DOMAIN_COMPARISON_TOLERANCE = { absolute: 1e-12 };
const BOUNDARY_SLACK = 1e-12;

/**
 * Validates a value against a ParameterSpec's model domain and visual range.
 *
 * THE ENUMERATED BRANCH COMES FIRST AND COMPARES LIKE WITH LIKE (am-hr4z). It used to sit after a
 * `Number.isFinite` guard and compare every member with a numeric tolerance, which refused the whole
 * declared domain of the 15 parameters whose members are strings: no number is "printed", so
 * me-01's `notation` rejected 0, 1, 7 AND "printed". A categorical value is not a number, so the
 * finite-number guard cannot come before the membership test, and a string member cannot be
 * compared on a numeric basis.
 *
 * MIXED KINDS ARE NOT MEMBERS, deliberately. `"1"` is not a member of `[0, 1, 2]` and `1` is not a
 * member of `["printed", "modern"]`. The second is the one that matters: 0 and 1 look like indices
 * into a two-member list, and admitting them would silently introduce a positional reading of a
 * categorical domain that nothing in the corpus uses.
 */
export function validateDomain(
  spec: ParameterSpec,
  value: number | string,
): DomainValidationResult {
  const { modelDomain, visualRange } = spec;

  // 1. Enumerated choices
  if (modelDomain.enumerated && modelDomain.enumerated.length > 0) {
    const isMember = modelDomain.enumerated.some((item) =>
      typeof item === "number" && typeof value === "number"
        ? withinTolerance(item, value, DOMAIN_COMPARISON_TOLERANCE).ok
        : item === value,
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
      // A categorical value has no position on the visual track, so it is never beyond it.
      isBeyondVisualTrack:
        typeof value === "number" && (value < visualRange.min || value > visualRange.max),
      enumerated: modelDomain.enumerated,
    };
  }

  // Past the categorical branch, every remaining check is arithmetic, so a non-numeric value has
  // no domain to be inside or outside of. This guard was the FIRST statement in the function until
  // am-hr4z; moving it below the membership test is what lets a string domain be checked at all.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      valid: false,
      status: "outside",
      isBeyondVisualTrack: false,
      explanation: "Value must be a finite number.",
    };
  }

  // 2. Minimum bound
  if (modelDomain.min !== undefined) {
    const minInclusive = modelDomain.minInclusive !== false;
    const violatesMin = minInclusive
      ? value < modelDomain.min - BOUNDARY_SLACK
      : value <= modelDomain.min + BOUNDARY_SLACK;
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
    const violatesMax = maxInclusive
      ? value > modelDomain.max + BOUNDARY_SLACK
      : value >= modelDomain.max - BOUNDARY_SLACK;
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
  if (
    modelDomain.min !== undefined &&
    withinTolerance(value, modelDomain.min, DOMAIN_COMPARISON_TOLERANCE).ok
  ) {
    isBoundary = true;
  }
  if (
    modelDomain.max !== undefined &&
    withinTolerance(value, modelDomain.max, DOMAIN_COMPARISON_TOLERANCE).ok
  ) {
    isBoundary = true;
  }

  const isBeyondVisualTrack =
    value < visualRange.min - BOUNDARY_SLACK || value > visualRange.max + BOUNDARY_SLACK;

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
    ("size" in spec.mapping && typeof spec.mapping.size === "number"
      ? spec.mapping.size
      : spec.step) ??
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
