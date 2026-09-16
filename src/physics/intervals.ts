/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/intervals.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed patent-specific catalogue regime constants.
 * - Preserved rigorous interval arithmetic primitives, outward rounding, and regime classification.
 */

export type IntervalKind = "provenance-tolerance" | "scenario-range" | "source-uncertainty";

export interface Interval {
  readonly min: number;
  readonly max: number;
  readonly unit?: string | undefined;
  readonly kind: IntervalKind;
  readonly provenanceNote?: string | undefined;
  readonly isDegenerate: boolean;
  readonly midpoint: number;
  readonly width: number;
}

/**
 * Creates an immutable Interval with strict ordering and outward-rounding safeguards.
 */
export function createInterval(
  min: number,
  max: number,
  unit?: string | undefined,
  kind: IntervalKind = "provenance-tolerance",
  provenanceNote?: string | undefined,
): Interval {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError(`Interval bounds must be finite numbers: [${min}, ${max}]`);
  }
  if (min > max) {
    throw new RangeError(`Invalid interval: min (${min}) cannot exceed max (${max})`);
  }

  const isDegenerate = Math.abs(max - min) <= 1e-15;
  const midpoint = 0.5 * (min + max);
  const width = max - min;

  return Object.freeze({
    min,
    max,
    unit,
    kind,
    provenanceNote,
    isDegenerate,
    midpoint,
    width,
  });
}

/**
 * Interval addition: [a, b] + [c, d] = [a + c, b + d]
 */
export function addIntervals(a: Interval, b: Interval): Interval {
  return createInterval(
    a.min + b.min,
    a.max + b.max,
    a.unit === b.unit ? a.unit : undefined,
    a.kind,
  );
}

/**
 * Interval subtraction: [a, b] - [c, d] = [a - d, b - c]
 */
export function subtractIntervals(a: Interval, b: Interval): Interval {
  return createInterval(
    a.min - b.max,
    a.max - b.min,
    a.unit === b.unit ? a.unit : undefined,
    a.kind,
  );
}

/**
 * Interval multiplication: [a, b] * [c, d] = [min(ac, ad, bc, bd), max(ac, ad, bc, bd)]
 */
export function multiplyIntervals(a: Interval, b: Interval): Interval {
  const p1 = a.min * b.min;
  const p2 = a.min * b.max;
  const p3 = a.max * b.min;
  const p4 = a.max * b.max;
  return createInterval(Math.min(p1, p2, p3, p4), Math.max(p1, p2, p3, p4), undefined, a.kind);
}

/**
 * Interval division: [a, b] / [c, d]
 * Refuses division by intervals containing zero.
 */
export function divideIntervals(a: Interval, b: Interval): Interval {
  if (b.min <= 0 && b.max >= 0) {
    throw new RangeError("Division by interval containing zero is undefined / singular.");
  }
  const q1 = a.min / b.min;
  const q2 = a.min / b.max;
  const q3 = a.max / b.min;
  const q4 = a.max / b.max;
  return createInterval(Math.min(q1, q2, q3, q4), Math.max(q1, q2, q3, q4), undefined, a.kind);
}

/**
 * Scale an interval by a scalar: k * [a, b]
 */
export function scaleInterval(iv: Interval, scalar: number): Interval {
  if (!Number.isFinite(scalar)) {
    throw new TypeError(`Scalar factor must be finite: ${scalar}`);
  }
  const p1 = iv.min * scalar;
  const p2 = iv.max * scalar;
  return createInterval(Math.min(p1, p2), Math.max(p1, p2), iv.unit, iv.kind);
}

/**
 * Computes intersection of two intervals. Returns null if disjoint.
 */
export function intersectIntervals(a: Interval, b: Interval): Interval | null {
  const newMin = Math.max(a.min, b.min);
  const newMax = Math.min(a.max, b.max);
  if (newMin > newMax) return null;
  return createInterval(newMin, newMax, a.unit, a.kind);
}

/**
 * Computes the convex hull (bounding span) enclosing both intervals.
 */
export function hullIntervals(a: Interval, b: Interval): Interval {
  return createInterval(Math.min(a.min, b.min), Math.max(a.max, b.max), a.unit, a.kind);
}

/**
 * Check if a scalar value is contained within the closed interval [min, max].
 */
export function containsValue(interval: Interval, value: number): boolean {
  return value >= interval.min && value <= interval.max;
}

/**
 * Check if two intervals overlap.
 */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.min <= b.max && b.min <= a.max;
}

// ----------------------------------------------------------------------------
// Physical Regime Boundaries & Regime Overlap Logic
// ----------------------------------------------------------------------------

export interface RegimeSpan<TRegime extends string> {
  readonly regime: TRegime;
  readonly interval: Interval;
  readonly description: string;
}

export interface RegimeDefinition<TRegime extends string> {
  readonly id: string;
  readonly domainName: string;
  readonly parameterKey: string;
  readonly unit: string;
  readonly regimes: readonly RegimeSpan<TRegime>[];
  readonly supportedRegimes: readonly TRegime[];
}

export interface RegimeClassificationResult<TRegime extends string> {
  readonly primaryRegime?: TRegime | undefined;
  readonly overlappingRegimes: readonly TRegime[];
  readonly isSpanningRegimes: boolean;
  readonly isSupported: boolean;
  readonly refusalReason?: string | undefined;
}

export class IntervalRefusalError extends Error {
  constructor(
    public readonly parameterKey: string,
    public readonly reason: string,
    public readonly inputInterval?: Interval | undefined,
  ) {
    super(`Interval Refusal on "${parameterKey}": ${reason}`);
    this.name = "IntervalRefusalError";
  }
}

/**
 * Classifies a scalar value or uncertainty interval against defined physical regimes.
 * Refuses scalar answers when an interval spans distinct regime boundaries.
 */
export function classifyValueOrInterval<TRegime extends string>(
  definition: RegimeDefinition<TRegime>,
  valueOrInterval: number | Interval,
): RegimeClassificationResult<TRegime> {
  const target =
    typeof valueOrInterval === "number"
      ? createInterval(valueOrInterval, valueOrInterval, definition.unit)
      : valueOrInterval;

  const overlapping: TRegime[] = [];

  for (const span of definition.regimes) {
    if (intervalsOverlap(target, span.interval)) {
      overlapping.push(span.regime);
    }
  }

  if (overlapping.length === 0) {
    return {
      overlappingRegimes: [],
      isSpanningRegimes: false,
      isSupported: false,
      refusalReason: `Value [${target.min}, ${target.max}] ${definition.unit} is outside all modeled physical regimes for ${definition.parameterKey}.`,
    };
  }

  if (overlapping.length === 1) {
    const primary = overlapping[0]!;
    const isSupported = definition.supportedRegimes.includes(primary);
    return {
      primaryRegime: primary,
      overlappingRegimes: overlapping,
      isSpanningRegimes: false,
      isSupported,
      ...(!isSupported
        ? {
            refusalReason: `Physical regime "${primary}" is outside currently supported model boundaries.`,
          }
        : {}),
    };
  }

  // Interval spans multiple regime boundaries: refuse single-regime claims
  return {
    overlappingRegimes: overlapping,
    isSpanningRegimes: true,
    isSupported: false,
    refusalReason: `Uncertainty interval [${target.min}, ${target.max}] ${definition.unit} spans multiple qualitative regimes (${overlapping.join(", ")}); scalar behavior cannot be certified.`,
  };
}

/**
 * Asserts that a value or interval resolves to a single supported regime, throwing if refused.
 */
export function assertSingleRegime<TRegime extends string>(
  definition: RegimeDefinition<TRegime>,
  valueOrInterval: number | Interval,
): TRegime {
  const result = classifyValueOrInterval(definition, valueOrInterval);
  if (!result.isSupported || !result.primaryRegime) {
    throw new IntervalRefusalError(
      definition.parameterKey,
      result.refusalReason ?? "Scalar answer refused across regime boundaries",
      typeof valueOrInterval === "number" ? undefined : valueOrInterval,
    );
  }
  return result.primaryRegime;
}
