/**
 * The shared named case table for `tolerance.ts`. `tolerance.test.ts` runs every case here,
 * and `am-test-logging-standard-l3cp` re-runs the same cases through its logging assertion
 * helpers so a failing case in either place names the identical scenario. Adding a case here
 * requires no change to the test file; adding an issue code, verdict kind, or sign requires a
 * case here before it is considered covered.
 */
import type {
  BitwiseKind,
  SignClassification,
  ToleranceBand,
  ToleranceIssueCode,
  ToleranceSpec,
  ToleranceVerdictKind,
} from "./tolerance.ts";

export type ValidateSpecCase = Readonly<{
  name: string;
  spec: ToleranceSpec;
  reference: number;
  expectedCodes: readonly ToleranceIssueCode[];
}>;

export const VALIDATE_SPEC_CASES: readonly ValidateSpecCase[] = [
  {
    name: "relative-only-zero-reference",
    spec: { relative: 1e-9 },
    reference: 0,
    expectedCodes: ["relative-only-at-zero"],
  },
  {
    name: "relative-only-away-from-zero-passes",
    spec: { relative: 1e-3 },
    reference: 10,
    expectedCodes: [],
  },
  {
    name: "absolute-only-avogadro",
    spec: { absolute: 1e-9 },
    reference: 6.17e23,
    expectedCodes: ["absolute-below-resolution"],
  },
  {
    name: "absolute-only-well-resolved-passes",
    spec: { absolute: 1e-6 },
    reference: 1,
    expectedCodes: [],
  },
  {
    name: "absolute-only-at-zero-reference-is-fine",
    spec: { absolute: 1e-9 },
    reference: 0,
    expectedCodes: [],
  },
  {
    name: "no-positive-tolerance-empty-spec",
    spec: {},
    reference: 1,
    expectedCodes: ["no-positive-tolerance"],
  },
  {
    name: "no-positive-tolerance-explicit-zeros",
    spec: { absolute: 0, relative: 0 },
    reference: 1,
    expectedCodes: ["no-positive-tolerance"],
  },
  {
    name: "no-positive-tolerance-passes-with-positive-absolute",
    spec: { absolute: 1e-6 },
    reference: 1,
    expectedCodes: [],
  },
  {
    name: "invalid-number-negative-absolute",
    spec: { absolute: -1 },
    reference: 1,
    expectedCodes: ["invalid-number"],
  },
  {
    name: "invalid-number-relative-at-upper-bound",
    spec: { relative: 1 },
    reference: 1,
    expectedCodes: ["invalid-number"],
  },
  {
    name: "invalid-number-nan-relative",
    spec: { relative: Number.NaN },
    reference: 1,
    expectedCodes: ["invalid-number"],
  },
  {
    name: "invalid-number-infinite-absolute",
    spec: { absolute: Number.POSITIVE_INFINITY },
    reference: 1,
    expectedCodes: ["invalid-number"],
  },
  {
    name: "invalid-number-passes-with-well-formed-spec",
    spec: { absolute: 1e-6, relative: 0.5 },
    reference: 1,
    expectedCodes: [],
  },
] as const;

export type ValidateAcrossCase = Readonly<{
  name: string;
  spec: ToleranceSpec;
  references: readonly number[];
  expectedCodes: readonly ToleranceIssueCode[];
}>;

export const VALIDATE_ACROSS_CASES: readonly ValidateAcrossCase[] = [
  {
    name: "absolute-only-across-magnitudes-fails",
    spec: { absolute: 0.5 },
    references: [1, 1e6],
    expectedCodes: ["absolute-only-across-magnitudes"],
  },
  {
    name: "absolute-only-within-1000x-passes",
    spec: { absolute: 0.5 },
    references: [1, 500],
    expectedCodes: [],
  },
  {
    name: "absolute-with-relative-component-across-magnitudes-passes",
    spec: { absolute: 0.5, relative: 1e-3 },
    references: [1, 1e6],
    expectedCodes: [],
  },
] as const;

export type WithinToleranceCase = Readonly<{
  name: string;
  actual: number;
  reference: number;
  spec: ToleranceSpec;
  expectedKind: ToleranceVerdictKind;
}>;

export const WITHIN_TOLERANCE_CASES: readonly WithinToleranceCase[] = [
  {
    name: "combined-boundary-within",
    actual: 1 + 1e-6,
    reference: 1,
    spec: { absolute: 1e-12, relative: 1e-6 },
    expectedKind: "within",
  },
  {
    name: "combined-boundary-outside",
    actual: 1 + 1.0001e-6,
    reference: 1,
    spec: { absolute: 1e-12, relative: 1e-6 },
    expectedKind: "outside",
  },
  {
    name: "reference-mode-asymmetry",
    actual: 10,
    reference: 1,
    spec: { relative: 0.9 },
    expectedKind: "outside",
  },
  {
    name: "larger-mode-would-have-passed-the-same-inputs",
    actual: 10,
    reference: 1,
    spec: { relative: 0.9, relativeTo: "larger" },
    expectedKind: "within",
  },
  {
    name: "nan-actual",
    actual: Number.NaN,
    reference: 1,
    spec: { relative: 1e-3 },
    expectedKind: "nonfinite-actual",
  },
  {
    name: "infinite-actual",
    actual: Number.POSITIVE_INFINITY,
    reference: 1,
    spec: { relative: 1e-3 },
    expectedKind: "nonfinite-actual",
  },
  {
    name: "infinite-reference",
    actual: 1,
    reference: Number.POSITIVE_INFINITY,
    spec: { relative: 1e-3 },
    expectedKind: "nonfinite-reference",
  },
  {
    name: "rms-displacement",
    actual: 7.9306e-7,
    reference: 7.93e-7,
    spec: { relative: 1e-3 },
    expectedKind: "within",
  },
  {
    name: "invalid-spec-propagates-as-invalid-spec",
    actual: 1,
    reference: 0,
    spec: { relative: 1e-9 },
    expectedKind: "invalid-spec",
  },
  {
    name: "exact-zero-both-sides",
    actual: 0,
    reference: 0,
    spec: { absolute: 1e-9 },
    expectedKind: "within",
  },
  {
    name: "tiny-scale-1e-minus-10",
    actual: 1e-10 * (1 + 1e-9),
    reference: 1e-10,
    spec: { relative: 1e-6 },
    expectedKind: "within",
  },
  {
    name: "huge-scale-1e-plus-10",
    actual: 1e10 * (1 + 1e-9),
    reference: 1e10,
    spec: { relative: 1e-6 },
    expectedKind: "within",
  },
  {
    name: "printed-avogadro-relative",
    actual: 6.17e23 * (1 + 1e-9),
    reference: 6.17e23,
    spec: { relative: 1e-6 },
    expectedKind: "within",
  },
] as const;

/** Ten fixed pairs with no zero (validation of a relative-only spec against an exact zero
 * reference is covered separately); `relativeTo: "larger"` must give the identical verdict
 * regardless of argument order. */
export const LARGER_MODE_SYMMETRY_PAIRS: readonly (readonly [number, number])[] = [
  [1, 1.0005],
  [10, 9],
  [-3, -3.002],
  [1e-6, 1.1e-6],
  [1e6, 0.9999e6],
  [5, 5],
  [-1, 1],
  [2.5, 2.5003],
  [1000, 998],
  [50, 55],
] as const;
export const LARGER_MODE_SYMMETRY_SPEC: ToleranceSpec = { relative: 1e-3, relativeTo: "larger" };

export type BitwiseCase = Readonly<{
  name: string;
  actual: unknown;
  expected: unknown;
  expectedOk: boolean;
  expectedKind: BitwiseKind;
}>;

export const BITWISE_CASES: readonly BitwiseCase[] = [
  {
    name: "positive-zero-vs-negative-zero-mismatch",
    actual: 0,
    expected: -0,
    expectedOk: false,
    expectedKind: "mismatch",
  },
  {
    name: "positive-zero-vs-positive-zero-match",
    actual: 0,
    expected: 0,
    expectedOk: true,
    expectedKind: "match",
  },
  // A NaN produced by any expression bit-pattern-matches any other NaN here: the ECMAScript
  // Number type does not preserve a NaN's payload across ordinary storage (every engine is
  // free to, and JavaScriptCore does, canonicalize it to 0x7ff8000000000000 on read), so two
  // "differently payloaded" NaN numbers are not constructible to compare in the first place.
  {
    name: "nan-from-division-matches-nan-literal",
    actual: 0 / 0,
    expected: Number.NaN,
    expectedOk: true,
    expectedKind: "match",
  },
  {
    name: "identical-uint32-philox-block-matches",
    actual: Uint32Array.of(1, 2, 3, 4),
    expected: Uint32Array.of(1, 2, 3, 4),
    expectedOk: true,
    expectedKind: "match",
  },
  {
    name: "off-by-one-uint32-element-mismatch",
    actual: Uint32Array.of(1, 2, 3, 4),
    expected: Uint32Array.of(1, 2, 999, 4),
    expectedOk: false,
    expectedKind: "mismatch",
  },
  {
    name: "float64array-negative-zero-element-mismatch",
    actual: Float64Array.of(1, 0, 3),
    expected: Float64Array.of(1, -0, 3),
    expectedOk: false,
    expectedKind: "mismatch",
  },
  {
    name: "digest-string-case-mismatch",
    actual: "deadBEEF",
    expected: "deadbeef",
    expectedOk: false,
    expectedKind: "mismatch",
  },
  {
    name: "digest-string-exact-match",
    actual: "deadbeef",
    expected: "deadbeef",
    expectedOk: true,
    expectedKind: "match",
  },
  {
    name: "canonical-decimal-seed-bigint-match",
    actual: 123456789012345678901234567890n,
    expected: 123456789012345678901234567890n,
    expectedOk: true,
    expectedKind: "match",
  },
  {
    name: "canonical-decimal-seed-bigint-mismatch",
    actual: 1n,
    expected: 2n,
    expectedOk: false,
    expectedKind: "mismatch",
  },
  {
    name: "plain-array-length-mismatch",
    actual: [1, 2, 3],
    expected: [1, 2],
    expectedOk: false,
    expectedKind: "length-mismatch",
  },
  {
    name: "number-vs-string-type-mismatch",
    actual: 5,
    expected: "5",
    expectedOk: false,
    expectedKind: "type-mismatch",
  },
] as const;

export type ClassifyCase = Readonly<{
  name: string;
  value: number;
  band: ToleranceBand;
  expectedSign: SignClassification;
}>;

export const CLASSIFY_CASES: readonly ClassifyCase[] = [
  {
    name: "indeterminate-inside-cancellation-band-1e-minus-20",
    value: 1e-20,
    band: { relative: 1e-12, scale: 1 },
    expectedSign: "indeterminate",
  },
  {
    name: "negative-outside-cancellation-band",
    value: -1e-3,
    band: { relative: 1e-12, scale: 1 },
    expectedSign: "negative",
  },
  { name: "exact-zero-with-exact-zero-band-is-zero", value: 0, band: {}, expectedSign: "zero" },
  {
    name: "zero-value-with-positive-band-is-indeterminate-never-zero",
    value: 0,
    band: { absolute: 1e-6 },
    expectedSign: "indeterminate",
  },
  {
    name: "positive-outside-absolute-band",
    value: 5,
    band: { absolute: 1 },
    expectedSign: "positive",
  },
  {
    name: "boundary-value-equals-allowed-is-indeterminate",
    value: 2,
    band: { absolute: 2 },
    expectedSign: "indeterminate",
  },
  {
    name: "positive-at-large-scale-1e-plus-10",
    value: 1e10,
    band: { relative: 1e-12, scale: 1e10 },
    expectedSign: "positive",
  },
] as const;
