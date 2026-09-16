/**
 * Dispatch to the single comparison module. This file must not implement
 * Math.abs closeness, rounding, or bitwise identity of its own.
 */
import {
  compareBitwise,
  type PrintedPrecision,
  type RoundingConvention,
  roundsTo,
  type ToleranceSpec,
  withinTolerance,
} from "../../units/tolerance.ts";

export function compareByKind(
  kind: "bitwise" | "tolerance" | "rounds-to",
  actual: unknown,
  expected: unknown,
  spec?: {
    tolerance?: ToleranceSpec;
    printedValue?: number;
    printedPrecision?: PrintedPrecision;
    roundingConvention?: RoundingConvention;
  },
): { ok: boolean; detail: Record<string, unknown> } {
  if (kind === "bitwise") {
    const verdict = compareBitwise(actual, expected);
    return { ok: verdict.ok, detail: { ...verdict } };
  }
  if (kind === "tolerance") {
    if (typeof actual !== "number" || typeof expected !== "number" || !spec?.tolerance) {
      return { ok: false, detail: { reason: "tolerance-comparison-needs-numbers" } };
    }
    const verdict = withinTolerance(actual, expected, spec.tolerance);
    return { ok: verdict.ok, detail: { ...verdict } };
  }
  if (
    typeof actual !== "number" ||
    spec?.printedValue === undefined ||
    spec.printedPrecision === undefined
  ) {
    return { ok: false, detail: { reason: "rounds-to-needs-printed-spec" } };
  }
  const verdict = roundsTo(
    actual,
    spec.printedValue,
    spec.printedPrecision,
    spec.roundingConvention ?? "half-up",
  );
  return {
    ok: verdict.ok,
    detail: {
      ok: verdict.ok,
      low: verdict.interval.low,
      high: verdict.interval.high,
      step: verdict.interval.step,
      printedValue: verdict.interval.printedValue,
      convention: verdict.convention,
    },
  };
}
