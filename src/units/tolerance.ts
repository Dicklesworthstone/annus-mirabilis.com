/**
 * The single tolerance and comparison module (AGENTS.md, "Precision and tolerance").
 * A relative tolerance alone is unsuitable near a true zero; an absolute tolerance alone is
 * unsuitable across orders of magnitude; a null-interval classification near cancellation may
 * legitimately return an indeterminate boundary result rather than a forced true/false. Every
 * comparison in tests, scenarios, and display imports this module instead of reimplementing
 * `Math.abs(a - b) <= tolerance`. Pure: no I/O, no logging, no globals, no Math.random.
 */

export type ToleranceRelativeTo = "reference" | "larger";

export type ToleranceSpec = Readonly<{
  absolute?: number;
  relative?: number;
  relativeTo?: ToleranceRelativeTo;
}>;

export type ToleranceIssueCode =
  | "no-positive-tolerance"
  | "invalid-number"
  | "relative-only-at-zero"
  | "absolute-below-resolution"
  | "absolute-only-across-magnitudes";

export type ToleranceIssue = Readonly<{ code: ToleranceIssueCode; message: string }>;

/**
 * Which equality standard a recorded comparison used (the structured-log `comparisonKind`
 * field). This module implements `bitwise` (`compareBitwise`) and `tolerance`
 * (`withinTolerance`). `formatted` -- both engines' full-precision values pushed through the
 * same precision/rounding rules and then compared as strings -- depends on the display rules
 * owned by the precision-display module; it is named here only so every layer that records a
 * comparison shares one vocabulary instead of inventing its own.
 */
export type ComparisonKind = "bitwise" | "tolerance" | "formatted" | "rounds-to";

const RELATIVE_UPPER_BOUND = 1; // relative must stay in [0, 1); see reference-mode-asymmetry.
const RESOLUTION_FACTOR = 4; // 4*EPSILON*|reference|: the smallest absolute step a double can distinguish there.

function isValidAbsolute(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}
function isValidRelative(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n < RELATIVE_UPPER_BOUND;
}
function resolveAbsolute(spec: ToleranceSpec): number {
  return spec.absolute !== undefined && isValidAbsolute(spec.absolute) ? spec.absolute : 0;
}
function resolveRelative(spec: ToleranceSpec): number {
  return spec.relative !== undefined && isValidRelative(spec.relative) ? spec.relative : 0;
}

/**
 * Validates one tolerance specification against a single reference value. A relative-only
 * spec cannot certify anything against an exact zero (any nonzero actual value is then an
 * unbounded relative error), and an absolute-only spec smaller than the double-precision
 * resolution at that magnitude asks for more digits than binary64 carries there.
 */
export function validateToleranceSpec(
  spec: ToleranceSpec,
  reference: number,
): readonly ToleranceIssue[] {
  const issues: ToleranceIssue[] = [];
  if (spec.absolute !== undefined && !isValidAbsolute(spec.absolute)) {
    issues.push({
      code: "invalid-number",
      message: `absolute tolerance ${spec.absolute} must be a finite number >= 0.`,
    });
  }
  if (spec.relative !== undefined && !isValidRelative(spec.relative)) {
    issues.push({
      code: "invalid-number",
      message: `relative tolerance ${spec.relative} must be a finite number in [0, 1).`,
    });
  }
  const anyInvalid = issues.length > 0;
  const absolute = resolveAbsolute(spec);
  const relative = resolveRelative(spec);

  if (!anyInvalid && absolute === 0 && relative === 0) {
    issues.push({
      code: "no-positive-tolerance",
      message:
        "Neither absolute nor relative tolerance is positive; use compareBitwise for an exact comparison instead.",
    });
  }

  const relativeOnly = relative > 0 && absolute === 0;
  const absoluteOnly = absolute > 0 && relative === 0;

  if (relativeOnly && reference === 0) {
    issues.push({
      code: "relative-only-at-zero",
      message:
        "A relative-only tolerance is unsuitable near a true zero: any nonzero actual value is an unbounded relative error against an exact-zero reference. Add an absolute tolerance.",
    });
  }
  if (absoluteOnly && reference !== 0) {
    const resolution = RESOLUTION_FACTOR * Number.EPSILON * Math.abs(reference);
    if (absolute < resolution) {
      issues.push({
        code: "absolute-below-resolution",
        message: `absolute tolerance ${absolute} demands more precision than binary64 carries at reference ${reference} (the smallest representable step there is about ${resolution}).`,
      });
    }
  }
  return Object.freeze(issues);
}

/**
 * Extends `validateToleranceSpec` across every reference an absolute-only spec is reused for.
 * An absolute tolerance alone is unsuitable across orders of magnitude: a step that is
 * generous at 1 is either meaningless slack at 10^6 or unattainable precision at 10^-6.
 */
export function validateToleranceSpecAcross(
  spec: ToleranceSpec,
  references: readonly number[],
): readonly ToleranceIssue[] {
  const issues: ToleranceIssue[] = [];
  const seen = new Set<string>();
  const record = (issue: ToleranceIssue): void => {
    const key = `${issue.code}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  };
  for (const reference of references)
    for (const issue of validateToleranceSpec(spec, reference)) record(issue);

  const absolute = resolveAbsolute(spec);
  const relative = resolveRelative(spec);
  if (absolute > 0 && relative === 0) {
    const magnitudes = references.map((r) => Math.abs(r)).filter((m) => m > 0);
    if (magnitudes.length > 0) {
      const min = Math.min(...magnitudes);
      const max = Math.max(...magnitudes);
      if (max / min > 1000) {
        record({
          code: "absolute-only-across-magnitudes",
          message: `An absolute-only tolerance of ${absolute} is reused across references spanning ${min} to ${max} (ratio ${max / min}); an absolute tolerance alone is unsuitable across orders of magnitude.`,
        });
      }
    }
  }
  return Object.freeze(issues);
}

export type ToleranceVerdictKind =
  | "within"
  | "outside"
  | "invalid-spec"
  | "nonfinite-actual"
  | "nonfinite-reference";

export type ToleranceVerdict = Readonly<{
  ok: boolean;
  kind: ToleranceVerdictKind;
  diff: number;
  allowed: number;
  issues: readonly ToleranceIssue[];
}>;

function verdict(
  ok: boolean,
  kind: ToleranceVerdictKind,
  diff: number,
  allowed: number,
  issues: readonly ToleranceIssue[] = [],
): ToleranceVerdict {
  return Object.freeze({ ok, kind, diff, allowed, issues });
}

/**
 * Compares `actual` against `reference` under `spec`. The allowed band is
 * max(absolute, relative * scale): `relativeTo: "reference"` (the default) scales by the
 * privileged side of a fixture such as a printed historical value; `relativeTo: "larger"`
 * scales symmetrically for two computed values with no privileged side (host evaluator vs.
 * WASM). NaN and infinity never pass, and a nonfinite reference is a caller error -- a
 * non-numeric expected result belongs in a typed status, not in a tolerance comparison. The
 * difference is compared directly, never through a formatted or rounded string, so a
 * cancellation near the boundary cannot be hidden by display rounding.
 */
export function withinTolerance(
  actual: number,
  reference: number,
  spec: ToleranceSpec,
): ToleranceVerdict {
  if (!Number.isFinite(reference))
    return verdict(false, "nonfinite-reference", Number.NaN, Number.NaN);
  if (!Number.isFinite(actual)) return verdict(false, "nonfinite-actual", Number.NaN, Number.NaN);

  const issues = validateToleranceSpec(spec, reference);
  if (issues.length > 0) return verdict(false, "invalid-spec", Number.NaN, Number.NaN, issues);

  const relativeTo = spec.relativeTo ?? "reference";
  const scale =
    relativeTo === "larger" ? Math.max(Math.abs(actual), Math.abs(reference)) : Math.abs(reference);
  const allowed = Math.max(spec.absolute ?? 0, (spec.relative ?? 0) * scale);
  const diff = Math.abs(actual - reference);
  const ok = diff <= allowed;
  return verdict(ok, ok ? "within" : "outside", diff, allowed);
}

// ---- Bitwise comparison --------------------------------------------------------------------

export type BitwiseKind = "match" | "mismatch" | "type-mismatch" | "length-mismatch";
export type BitwiseVerdict = Readonly<{ ok: boolean; kind: BitwiseKind; detail: string }>;

const bitBuffer = new ArrayBuffer(8);
const bitFloatView = new Float64Array(bitBuffer);
const bitIntView = new BigUint64Array(bitBuffer);

/** The exact IEEE-754 bit pattern of a double, so +0 and -0 are told apart -- something
 * `===` alone does not do (`0 === -0` is `true`). */
function float64Bits(value: number): bigint {
  bitFloatView[0] = value;
  const bits = bitIntView[0];
  if (bits === undefined)
    throw new Error("unreachable: bitIntView always holds exactly one element.");
  return bits;
}

function bitwiseEqualScalar(a: number | bigint, b: number | bigint): boolean {
  if (typeof a === "bigint" || typeof b === "bigint") return a === b;
  return float64Bits(a) === float64Bits(b);
}

function isNumericArrayLike(x: unknown): x is ArrayLike<number | bigint> {
  return x instanceof Uint32Array || x instanceof Float64Array || Array.isArray(x);
}

function describeBitwiseType(x: unknown): string {
  if (x === null) return "null";
  if (x instanceof Uint32Array) return "Uint32Array";
  if (x instanceof Float64Array) return "Float64Array";
  if (Array.isArray(x)) return "array";
  return typeof x;
}

function compareArraysBitwise(
  actual: ArrayLike<number | bigint>,
  expected: ArrayLike<number | bigint>,
): BitwiseVerdict {
  if (actual.length !== expected.length) {
    return Object.freeze({
      ok: false,
      kind: "length-mismatch" as const,
      detail: `lengths differ: ${actual.length} vs ${expected.length}`,
    });
  }
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const b = expected[i];
    const equal = a !== undefined && b !== undefined && bitwiseEqualScalar(a, b);
    if (!equal) {
      return Object.freeze({
        ok: false,
        kind: "mismatch" as const,
        detail: `first differing index: ${i} (${String(a)} vs ${String(b)})`,
      });
    }
  }
  return Object.freeze({
    ok: true,
    kind: "match" as const,
    detail: `identical across ${actual.length} elements`,
  });
}

/**
 * Exact comparison for values that must never drift by rounding: Philox integer streams,
 * digests, and canonical decimal seeds. Bitwise identity across architectures, compilers, and
 * browsers is not promised for floating-point results, but these discrete values are promised
 * exact, so every recorded comparison says which kind it used. Numbers compare by bit pattern,
 * so +0 and -0 (exactly representable and preserved by IEEE-754 double storage) differ; a NaN
 * compares equal to any other NaN, because the ECMAScript Number type does not preserve a
 * NaN's payload bits across ordinary storage, so there is no observably "different" NaN number
 * to disagree with. Bigints and strings compare exactly; typed and plain numeric arrays
 * compare elementwise and report the first differing index.
 */
export function compareBitwise(actual: unknown, expected: unknown): BitwiseVerdict {
  if (typeof actual === "number" && typeof expected === "number") {
    const equal = float64Bits(actual) === float64Bits(expected);
    return Object.freeze({
      ok: equal,
      kind: equal ? ("match" as const) : ("mismatch" as const),
      detail: equal
        ? "identical IEEE-754 bit patterns"
        : `bit patterns differ: 0x${float64Bits(actual).toString(16)} vs 0x${float64Bits(expected).toString(16)}`,
    });
  }
  if (typeof actual === "bigint" && typeof expected === "bigint") {
    const equal = actual === expected;
    return Object.freeze({
      ok: equal,
      kind: equal ? ("match" as const) : ("mismatch" as const),
      detail: equal ? "identical bigint value" : `bigint values differ: ${actual} vs ${expected}`,
    });
  }
  if (typeof actual === "string" && typeof expected === "string") {
    const equal = actual === expected;
    return Object.freeze({
      ok: equal,
      kind: equal ? ("match" as const) : ("mismatch" as const),
      detail: equal ? "identical string" : "strings differ",
    });
  }
  if (isNumericArrayLike(actual) && isNumericArrayLike(expected)) {
    return compareArraysBitwise(actual, expected);
  }
  return Object.freeze({
    ok: false,
    kind: "type-mismatch" as const,
    detail: `unsupported or mismatched types: ${describeBitwiseType(actual)} vs ${describeBitwiseType(expected)}`,
  });
}

// ---- Cancellation-aware sign classification ------------------------------------------------

export type SignClassification = "negative" | "positive" | "zero" | "indeterminate";
export type ToleranceBand = Readonly<{ absolute?: number; relative?: number; scale?: number }>;
export type ClassificationVerdict = Readonly<{ sign: SignClassification; allowed: number }>;

/**
 * Classifies the sign of a value that may be the difference of two large, nearly equal terms
 * (e.g. c^2 t^2 - x^2 near the light cone). `band.scale` is the magnitude of the cancelling
 * terms, not a statistical spread: this is an interval-arithmetic-style enclosure around zero,
 * never a probability confidence interval and never a numerical error bar -- those are
 * separate kinds owned elsewhere and are never represented by this band. A value inside the
 * band is honestly `indeterminate`; it is never coerced to `zero`. `zero` is reserved for the
 * exact arithmetic path: the value is exactly 0 and the band itself is exactly 0.
 */
export type PrintedPrecision =
  | Readonly<{ significantFigures: number }>
  | Readonly<{ decimals: number }>;
export type RoundingConvention = "half-up" | "half-even";
export type RoundingInterval = Readonly<{
  low: number;
  high: number;
  step: number;
  printedValue: number;
}>;
export type RoundsToVerdict = Readonly<{
  ok: boolean;
  interval: RoundingInterval;
  convention: RoundingConvention;
}>;

function roundingStep(printedValue: number, printedPrecision: PrintedPrecision): number {
  if ("decimals" in printedPrecision) {
    if (!Number.isInteger(printedPrecision.decimals) || printedPrecision.decimals < 0) {
      throw new RangeError("printedPrecision.decimals must be a nonnegative integer.");
    }
    return 10 ** -printedPrecision.decimals;
  }
  if (
    !Number.isInteger(printedPrecision.significantFigures) ||
    printedPrecision.significantFigures < 1
  ) {
    throw new RangeError("printedPrecision.significantFigures must be an integer >= 1.");
  }
  if (!Number.isFinite(printedValue) || printedValue === 0) {
    throw new RangeError("significantFigures rounding needs a finite nonzero printed value.");
  }
  return (
    10 ** (Math.floor(Math.log10(Math.abs(printedValue))) - printedPrecision.significantFigures + 1)
  );
}

/**
 * Half-open interval around a printed figure. For 0,8 Mikron at 1 significant figure this is
 * [0.75, 0.85) μm. The interval is a statement about what the printer set, not a numerical
 * error bar, and a qualifier such as "ca." never widens it.
 */
export function roundingInterval(
  printedValue: number,
  printedPrecision: PrintedPrecision,
): RoundingInterval {
  if (!Number.isFinite(printedValue)) {
    throw new RangeError("roundingInterval requires a finite printed value.");
  }
  const step = roundingStep(printedValue, printedPrecision);
  return Object.freeze({
    low: printedValue - step / 2,
    high: printedValue + step / 2,
    step,
    printedValue,
  });
}

function roundHalfEvenToStep(value: number, step: number): number {
  const units = value / step;
  const floor = Math.floor(units);
  const frac = units - floor;
  if (frac !== 0.5) return Math.round(units) * step;
  return (floor % 2 === 0 ? floor : floor + 1) * step;
}

/**
 * Historical printed-rounding comparison. `half-up` uses the derived half-open interval.
 * `half-even` rounds the recomputation to the printed place with banker's rounding and
 * compares that to the printed value. The registry must call this and must not implement a
 * second comparison.
 */
export function roundsTo(
  value: number,
  printedValue: number,
  printedPrecision: PrintedPrecision,
  roundingConvention: RoundingConvention = "half-up",
): RoundsToVerdict {
  const interval = roundingInterval(printedValue, printedPrecision);
  if (!Number.isFinite(value)) {
    return Object.freeze({ ok: false, interval, convention: roundingConvention });
  }
  const ok =
    roundingConvention === "half-even"
      ? roundHalfEvenToStep(value, interval.step) === printedValue
      : value >= interval.low && value < interval.high;
  return Object.freeze({ ok, interval, convention: roundingConvention });
}

export function classifyWithTolerance(
  value: number,
  band: ToleranceBand = {},
): ClassificationVerdict {
  if (!Number.isFinite(value))
    throw new TypeError("classifyWithTolerance requires a finite value.");
  const absolute = band.absolute ?? 0;
  const relative = band.relative ?? 0;
  const scale = band.scale ?? 0;
  if (![absolute, relative, scale].every((n) => Number.isFinite(n) && n >= 0)) {
    throw new RangeError("Tolerance band components must be finite and nonnegative.");
  }
  const allowed = Math.max(absolute, relative * scale);
  const sign: SignClassification =
    value === 0 && allowed === 0
      ? "zero"
      : allowed > 0 && Math.abs(value) <= allowed
        ? "indeterminate"
        : value > 0
          ? "positive"
          : "negative";
  return Object.freeze({ sign, allowed });
}
